#!/usr/bin/env python3
"""Rebuild every catalogue page from catalog.json in the approved page templates."""
from pathlib import Path
import json
import re
from catalog_model import ROOT,Node,parse,load_catalog,card_for,search_text,podcast_priority
from html import escape

def replace_text(node,value):node.children=[value]

def build():
    data=load_catalog();resources=data['resources'];report={}
    for page,config in data['pages'].items():
        tree=parse(ROOT/'templates/catalog'/(page+'.html'))
        lists={n.attrs['id']:n for n in tree.walk() if 'data-catalog-list' in n.attrs}
        body=next(n for n in tree.walk() if n.tag=='body')
        body.attrs['data-catalog-source']='english-catalogue'
        for group in config['groups']:
            listing=lists[group['id']];cards=[]
            if page=='all-tools':
                selected=[(r,None) for r in resources if r['catalogGroup']==group['id']]
            else:
                selected=[(r,p) for r in resources for p in r['placements'] if p['page']==page and p['group']==group['id']]
                selected.sort(key=lambda item:((podcast_priority(item[0]['url']) if page=='listening' and group['id']=='listening-list-1' else 0),item[1].get('order',0)))
            cards=[card_for(r,p) for r,p in selected]
            cards+=[Node('div',{'id':entry['id'],'class':'link-card is-broken','title':entry['name']},[Node('span',{'class':'link-card__body'},[Node('strong',{'class':'link-card__title'},[entry['name']]),Node('span',{'class':'link-card__desc'},[entry['description']])])]) for entry in data.get('unavailable',[]) if any(p['page']==page and p['group']==group['id'] for p in entry['placements'])]
            listing.children=cards
            listing.attrs['data-catalog-label']=group['label']
            # Keep legacy internal anchors that used to point at duplicate cards.
            parent=next(n for n in tree.walk() if listing in n.children)
            used={n.attrs.get('id') for n in tree.walk() if n.attrs.get('id')}
            aliases=[]
            for alias in group.get('anchors',[]):
                if alias not in used and alias and not re.search(r'ingiliz|turk',alias,re.I):
                    aliases.append(Node('span',{'id':alias,'class':'catalog-anchor-alias','aria-hidden':'true'}));used.add(alias)
            if aliases:parent.children[0:0]=aliases
            for n in parent.walk():
                if 'data-catalog-list-count' in n.attrs:replace_text(n,str(len(cards))+' ресурсов')
            if not cards:
                parent.attrs['hidden']=None
                heading=next((n for n in tree.walk() if n.attrs.get('id')==group.get('headingId')),None)
                if heading:
                    heading.attrs['hidden']=None
                    section=next(n for n in tree.walk() if heading in n.children)
                    for sibling in section.children[section.children.index(heading)+1:]:
                        if sibling is parent:break
                        if isinstance(sibling,Node):sibling.attrs['hidden']=None
        count=sum(len(n.children) for n in lists.values())
        report[page]=count
        for n in tree.walk():
            if n.attrs.get('id')=='catalog-results-count':replace_text(n,str(len(resources))+' ресурсов в каталоге')
            if page=='all-tools' and n.tag=='meta' and n.attrs.get('name')=='description':n.attrs['content']='Инструменты и материалы для английского. Поиск по названию, теме и направлению.'
            if n.has('catalog-search-hint') and page=='grammar':
                n.children=[str(count)+' ресурсов из единого каталога. ',Node('a',{'href':'/links/all-tools.html?skill=grammar'},['Открыть поиск по грамматике'])]
        output=ROOT/'dist/links'/(page+'.html');output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text('<!doctype html>\n'+tree.html().lstrip())
    for page,target in data.get('redirects',{}).items():
        output=ROOT/'dist/links'/(page+'.html')
        output.write_text('<!doctype html>\n<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url='+escape(target,quote=True)+'"><title>Инструменты — English.tools</title></head><body data-page="redirect"><p><a href="'+escape(target,quote=True)+'">Все инструменты</a></p></body></html>\n')
    search=[{'id':r['id'],'name':r['name'],'url':r['url'],'description':r['description'],'search':search_text(r)} for r in resources]
    (ROOT/'dist/englinks-search.json').write_text(json.dumps(search,ensure_ascii=False,indent=2)+'\n')
    # Compatibility export for historical scripts; all entries come from the same
    # English-only catalogue instead of a second imported resource collection.
    (ROOT/'dist/englinks-data.js').write_text("'use strict';\nconst englinksTools = "+json.dumps(resources,ensure_ascii=False)+';\n')
    (ROOT/'research/catalogue-build-2026-10-07.json').write_text(json.dumps({'resources':len(resources),'pages':report},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'resources':len(resources),'pages':report},ensure_ascii=False,indent=2))

if __name__=='__main__':build()
