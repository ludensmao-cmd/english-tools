#!/usr/bin/env python3
"""Assemble one static site shell; scope attributes are present before first paint."""
from pathlib import Path
import argparse,json,re,runpy
args=argparse.ArgumentParser(description=__doc__)
args.add_argument('--home-only',action='store_true',help='Rebuild only the homepage shell')
args.add_argument('--blog-only',action='store_true',help='Rebuild only the blog index shell')
args.add_argument('--catalog-only',action='store_true',help='Rebuild only the resource catalogue pages')
args.add_argument('--listening-only',action='store_true',help='Rebuild only the listening catalogue page')
options=args.parse_args()
ROOT=Path(__file__).resolve().parents[1]
lib=runpy.run_path(str(ROOT/'scripts/build_englinks_shell.py'))
Node,Parser=lib['Node'],lib['Parser']
markup=lib['result']
catalog_lobby=runpy.run_path(str(ROOT/'scripts/catalog_lobby.py'))
rules={
 'Layout':'49b94f76','VPContent':'1fcbc27d','VPDoc':'bbe6346a','VPDocFooter':'d2882a89',
 'VPDocAside':'6d33de53','VPDocAsideOutline':'5ec074d0','VPDocOutlineItem':'b83511b5',
 'category-hero':'0770416a','prompt-grid':'441c0934','prompt-card':'97d45cc3','prompt-studio':'884f193a','prompt-builder':'baf11759',
 'lang-select':'b48efea9','prompt-select':'40ffc60b','level-picker':'b0592b75','copy-btn':'f173524b','prompt-launcher':'b56f934f',
 'blog-list':'21e8d7a0','blog-item':'21e8d7a0','post-meta':'3d5914e5','cta-card':'26199855','app-icon':'6d3ae1c9',
 'VPNav':'3d3b6169','VPNavBar':'b5a09ea0','VPNavBarTitle':'8ff585d9','VPNavBarMenu':'207cb7fd','VPNavBarMenuLink':'0d4d3bc8',
 'VPLocalNav':'0136a48c','VPLocalNavOutlineDropdown':'76781761','VPSidebar':'d29ff30c','VPSidebarItem':'9f71b922',
 'dict-menu':'cfdde793','link-card-container':'2081125e','link-card-list':'2081125e','link-card':'b57d5ded',
 'VPNavBarHamburger':'2e045c15','VPNavScreen':'3de96e2e','VPNavScreenMenuLink':'c187123a'
}
boundaries=set(rules)|{'vp-doc','VPNavBarSearch','VPNavBarAppearance','VPSocialLinks','VPFlyout'}
def component(n):return isinstance(n,Node) and bool(set(n.attrs.get('class','').split())&boundaries)
def stamp_own(root,scope):
 key='data-v-'+scope;root.attrs[key]=None
 def walk(n):
  for child in n.children:
   if not isinstance(child,Node):continue
   child.attrs[key]=None
   if not component(child):walk(child)
 walk(root)
def scope_tree(tree):
 for n in list(tree.walk()):
  for c in n.attrs.get('class','').split():
   if c in rules:stamp_own(n,rules[c])
files=[ROOT/'dist'/n for n in ['index.html','guide.html','faq.html','about.html','telegram.html','materials.html','ai.html','lessons/index.html']]
files+=list((ROOT/'dist/materials').glob('*.html'))+list((ROOT/'dist/links').rglob('*.html'))
if options.listening_only:files=[ROOT/'dist/links/listening.html']
elif options.home_only:files=[ROOT/'dist/index.html']
elif options.blog_only:files=[ROOT/'dist/materials.html']
elif options.catalog_only:files=list((ROOT/'dist/links').rglob('*.html'))
nojs='''<noscript><style>.VPNav{position:relative!important}.VPContent{padding-top:0!important;padding-left:0!important}.VPNavBarHamburger,.VPLocalNav,.VPSidebar,.DocSearch-Button{display:none!important}</style><nav class="no-js-links" aria-label="Навигация без JavaScript"><a href="/links/all-tools.html">Инструменты</a><a href="/ai.html">Урок с ИИ</a><a href="/materials.html">Блог</a><a href="/telegram.html">Telegram</a></nav></noscript>'''
for p in files:
 s=p.read_text()
 s=re.sub(r'<link[^>]+rel="preconnect"[^>]+href="https://fonts\.(?:gstatic|googleapis)\.com"[^>]*>','',s)
 s=re.sub(r'<!-- ENGLISH SHELL START -->[\s\S]*?<!-- ENGLISH SHELL END -->','',s)
 s=s.replace('<!-- COMMON HEADER -->','')
 s=re.sub(r'<script[^>]+src="/englinks-(?:scopes|shell-markup)\.js[^\"]*"[^>]*></script>','',s)
 parsed=Parser();parsed.feed(s);body=next(n for n in parsed.root.walk() if n.tag=='body')
 if body.attrs.get('data-page')=='redirect':continue
 cabinet='cabinet-page' in body.attrs.get('class','').split()
 home=body.attrs.get('data-page')=='home'
 catalog=body.attrs.get('data-page')=='catalog'
 public_inner=not home and not cabinet
 if public_inner:
  classes=body.attrs.get('class','').split()
  if 'lobby-shell' not in classes:classes.append('lobby-shell')
  body.attrs['class']=' '.join(classes)
  head=next(n for n in parsed.root.walk() if n.tag=='head')
  head.children=[n for n in head.children if not (isinstance(n,Node) and n.tag=='link' and n.attrs.get('href','').startswith('/lobby-shell.css'))]
  head.children.append(Node('link',[('rel','stylesheet'),('href','/lobby-shell.css?v=shared-lobby-20261006')]))
 if p==ROOT/'dist/materials.html':
  next(n for n in parsed.root.walk() if n.tag=='title').children=['Блог — English.tools']
  heading=next(n for n in body.walk() if n.tag=='h1')
  heading.children=['Блог ']+[n for n in heading.children if isinstance(n,Node)]
  for anchor in heading.walk():
   if anchor.tag=='a':anchor.attrs['aria-label']='Ссылка на раздел «Блог»'
 if catalog:
  catalog_lobby['prepare_catalog'](body,Node,ROOT)
  if body.attrs.get('data-listening-layout')=='formats':
   next(n for n in parsed.root.walk() if n.tag=='title').children=['Аудирование — English.tools']
  if 'catalog-lobby.css' not in s:
   head=next(n for n in parsed.root.walk() if n.tag=='head')
   head.children.append(Node('link',[('rel','stylesheet'),('href','/catalog-lobby.css?v=catalog-folder-20261006')]))
 if not cabinet and 'home-fonts.css' not in s:
  head=next(n for n in parsed.root.walk() if n.tag=='head')
  font=Node('link',[('rel','stylesheet'),('href','/home-fonts.css?v=lobby-20261002')])
  head.children.append(font)
 layout=body.find('Layout')
 if not layout:
  layout=Node('div',[('class','Layout')]);layout.children=body.children;body.children=[layout]
 content=layout.find('VPContent')
 if p==ROOT/'dist/materials.html':
  for region in [content,content.find('VPDoc')]:
   if not region.has('has-sidebar'):region.attrs['class']+=' has-sidebar'
 has_sidebar=content.has('has-sidebar')
 chrome_parser=Parser();chrome_parser.feed(markup['header'])
 header=chrome_parser.root.find('VPNav')
 if public_inner:
  catalog_lobby['prepare_header'](header,Node,Parser,lib['remove'])
  header.find('catalog-telegram-label').attrs['class']='lobby-telegram-label'
 if cabinet:lib['remove'](header,{'VPNavBarMenu','VPNavBarSearch'})
 if home:
  lib['remove'](header,{'VPNavBarSearch'})
  for link in header.walk():
   if link.tag=='a' and link.attrs.get('href')=='/materials.html':
    label=next(n for n in link.walk() if n.tag=='span');label.children=['Блог']
  telegram=header.find('english-telegram-nav')
  plane=Parser();plane.feed('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-6 18-4-8-8-4 18-6Z"/><path d="m11 13 6-6"/></svg>')
  telegram.children=plane.root.children+telegram.children
  telegram.attrs['class']='english-telegram-nav'
  telegram.attrs['aria-label']='Telegram'
  next(n for n in telegram.walk() if n.tag=='span').attrs['class']='home-telegram-label'
  header.find('VPNavBarMenu').children.remove(telegram)
  header.find('content-body').children.append(telegram)
 if not has_sidebar:
  title=header.find('VPNavBarTitle');title.attrs['class']=title.attrs['class'].replace(' has-sidebar','')
  header.find('VPNavBar').attrs['class']+=' no-sidebar'
 navscreen=Node('div',[('class','VPNavScreen'),('id','VPNavScreen'),('data-v-3de96e2e',None),('hidden',None)])
 header.children.append(navscreen)
 chrome=header.html()
 if has_sidebar and not cabinet:
  sidebar=markup['sidebar']
  sidebar_parser=Parser();sidebar_parser.feed(sidebar)
  catalog_lobby['prepare_sidebar'](sidebar_parser.root,ROOT)
  sidebar=sidebar_parser.root.html()
  chrome+=markup['local']+sidebar
 if not cabinet:chrome+=nojs.replace('>Материалы<','>Блог<') if home else nojs
 if public_inner:
  lib['remove'](body,{'english-doc-footer'})
  footer_parser=Parser();footer_parser.feed('<footer class="english-doc-footer"><a class="footer-brand" href="/" aria-label="English.tools — на главную"><img src="/brand/english-tools-transparent.png" alt="English.tools" width="132" height="66" loading="lazy"></a><nav aria-label="Ссылки в подвале"><a href="/guide.html">Как пользоваться</a><a href="/faq.html">Вопросы</a><a href="/about.html">О проекте</a><a href="#top">Наверх</a></nav></footer>')
  layout.find('content-container').children.extend(footer_parser.root.children)
 # Tokens survive serialization; script data must remain raw HTML, not entity-escaped.
 raw=[]
 for n in parsed.root.walk():
  if n.tag in {'script','style'}:
   raw.append((''.join(c if isinstance(c,str) else c.html() for c in n.children),n))
   n.children=['__ENGLISH_RAW_'+str(len(raw)-1)+'__']
 scope_tree(parsed.root)
 s='<!doctype html>\n'+parsed.root.html().lstrip()
 for i,(original,n) in enumerate(raw):s=s.replace('__ENGLISH_RAW_'+str(i)+'__',original)
 s=s.replace('<div class="Layout"', '<div class="Layout"',1)
 # Insert chrome after the opening Layout tag, including its source attrs.
 s=re.sub(r'(<div class="Layout"[^>]*>)',lambda m:m.group(1)+'<!-- ENGLISH SHELL START -->'+chrome+'<!-- ENGLISH SHELL END -->',s,count=1)
 if cabinet:
  s=s.replace('<script src="/englinks-shell.js','<script src="/englinks-shell-markup.js?v=ready-20261002" defer></script><script src="/englinks-shell.js',1)
 if 'site-config.js' not in s:s=s.replace('<script src="/englinks-shell.js','<script src="/site-config.js?v=ready-20261002" defer></script><script src="/englinks-shell.js',1)
 # Changes are cached consistently for every live stylesheet and script.
 version='home-footer-20261006' if home else ('catalog-heading-flow-20261006' if catalog else ('inner-shell-20261006-2' if public_inner else 'blog-nav-20261006'))
 if body.attrs.get('data-listening-layout')=='formats':version='listening-formats-20261006'
 version='russian-tools-20261007'
 s=re.sub(r'((?:src|href)="[^"?]+\.(?:js|css))\?v=[^" ]+',lambda m:m.group(1)+'?v='+version,s)
 p.write_text(s)
print('One static shell assembled on',len(files),'pages; runtime CSS stamping removed')
