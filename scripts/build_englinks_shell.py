#!/usr/bin/env python3
"""Preserve reference component markup and Vue CSS scopes in a static local shell."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import copy,json,re,sys
from urllib.parse import urlsplit,parse_qs
ROOT=Path(__file__).resolve().parents[1]
VOID={'img','input','hr','br','meta','link','source','wbr','area','base','embed','param','track'}
class Node:
 def __init__(self,tag='',attrs=None):self.tag=tag;self.attrs=dict(attrs or []);self.children=[]
 def has(self,c):return c in self.attrs.get('class','').split()
 def find(self,c):
  if self.has(c):return self
  for n in self.children:
   if isinstance(n,Node):
    result=n.find(c)
    if result:return result
 def walk(self):
  yield self
  for n in self.children:
   if isinstance(n,Node):yield from n.walk()
 def html(self):
  if not self.tag:return ''.join(x.html() if isinstance(x,Node) else escape(x,quote=False) for x in self.children)
  a=''.join(' '+k+('="'+escape(v,quote=True)+'"' if v is not None else '') for k,v in self.attrs.items())
  return '<'+self.tag+a+'>'+('' if self.tag in VOID else ''.join(x.html() if isinstance(x,Node) else escape(x,quote=False) for x in self.children)+'</'+self.tag+'>')
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.root=Node();self.stack=[self.root]
 def handle_starttag(self,t,a):
  n=Node(t,a);self.stack[-1].children.append(n)
  if t not in VOID:self.stack.append(n)
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==t:self.stack=self.stack[:i];break
 def handle_data(self,d):self.stack[-1].children.append(d)
p=Parser();p.feed((ROOT/'research/englinks/raw/links_reading.html').read_text())
translations={'Resources':'Инструменты','AI Partner':'Урок с ИИ','Blog':'Блог','Dictionaries':'Словари','Search 550+ resources':'Поиск инструментов','Main Navigation':'Главное меню','Sidebar Navigation':'Направления','Menu':'Меню','Return to top':'Наверх',"Editor's Choice":'С чего начать','Reading':'Чтение','Listening':'Аудирование','Vocabulary':'Слова и словари','Courses':'Курсы','Cinema & TV':'Кино и сериалы','Speaking':'Говорение','Writing':'Письмо','Social Media':'Соцсети','Prompt Library':'Библиотека запросов','Writing Scenarios':'Сценарии письма','Language Skills':'Языковые навыки',"Learner's Dictionaries":'Учебные словари','Translation & Context':'Перевод и контекст','Thesaurus & Etymology':'Синонимы и происхождение слов','More Resources':'Другие словари'}
route={'/ai/prompts':'/ai.html','/ai/skills':'/ai.html?view=skills','/ai/writing':'/ai.html?view=writing','/blog/':'/materials.html'}
icons=json.loads(re.search(r'const englinksIconFiles = (\{[\s\S]*?\});',(ROOT/'dist/resource-icons.js').read_text()).group(1))
def icon_for(host):
 host=host.removeprefix('www.')
 while host:
  key=host.replace('.','-')
  if key in icons:return '/brand/resource-icons/'+icons[key]
  host=host.split('.',1)[1] if '.' in host else ''
 return '/brand/resource-icon.svg'
def remove(node,classes):
 node.children=[n for n in node.children if not isinstance(n,Node) or not any(n.has(c) for c in classes)]
 for n in node.children:
  if isinstance(n,Node):remove(n,classes)
def transform(n):
 for key in ['href','src']:
  value=n.attrs.get(key,'')
  if value.startswith('/links/'):n.attrs[key]=value+'.html'
  elif value in route:n.attrs[key]=route[value]
 if n.tag=='img' and 'google.com/s2/favicons' in n.attrs.get('src',''):
  n.attrs['src']=icon_for(parse_qs(urlsplit(n.attrs['src']).query).get('domain',[''])[0])
 if n.attrs.get('aria-label')=='Search site':n.attrs['aria-label']='Поиск по всем инструментам'
 if n.attrs.get('aria-label')=='mobile navigation':n.attrs['aria-label']='Открыть меню'
 for i,c in enumerate(n.children):
  if isinstance(c,Node):transform(c)
  else:
   trimmed=c.strip()
   if trimmed in translations:n.children[i]=c.replace(trimmed,translations[trimmed])
 for c in ['active','has-active','is-active-link']:
  n.attrs['class']=' '.join(x for x in n.attrs.get('class','').split() if x!=c) if 'class'in n.attrs else n.attrs.get('class','')
 if n.attrs.get('class')=='':n.attrs.pop('class',None)
header=p.root.find('VPNav');remove(header,{'VPNavBarTranslations','VPNavBarSocialLinks','VPNavBarExtra'})
brand=header.find('VPNavBarTitle').find('title')
brand.children=[Node('img',[('class','VPImage logo english-brand'),('src','/brand/english-tools-transparent.png'),('alt','English.tools — на главную'),('width','144'),('height','72'),('data-v-e6b61155',None)])]
sidebar=p.root.find('VPSidebar');local=p.root.find('VPLocalNav')
for n in [header,sidebar,local]:transform(n)
# Menus use the same English catalogue as cards and search. Research snapshots
# supply component structure only, never a second active resource list.
sys.path.insert(0,str(ROOT/'scripts'))
from catalog_model import load_catalog
resources=load_catalog()['resources']
panel=header.find('dict-menu__panel')
for group_node in [n for n in panel.children if isinstance(n,Node) and n.has('dict-menu__group')]:
 title=group_node.find('dict-menu__title')
 label=''.join(c if isinstance(c,str) else '' for c in title.children).strip()
 prototype=next(n for n in group_node.children if isinstance(n,Node) and n.tag=='a')
 links=[]
 for row in resources:
  if row.get('dictionaryGroup')!=label:continue
  link=copy.deepcopy(prototype);link.attrs['href']=row['url']
  image=next(n for n in link.walk() if n.tag=='img');image.attrs['src']=row.get('icon') or icon_for(urlsplit(row['url']).hostname or '')
  image.attrs['alt']=''
  name=link.find('dict-menu__text');name.children=[row['name']]
  links.append(link)
 group_node.children=[title]+links
def prune_removed_ai(node):
 node.children=[c for c in node.children if not (isinstance(c,Node) and c.has('VPSidebarItem') and c.has('level-1') and any(n.attrs.get('href') in ['/ai.html','/ai.html?view=writing','/links/social-media.html'] for n in c.walk()))]
 for child in node.children:
  if isinstance(child,Node):prune_removed_ai(child)
prune_removed_ai(sidebar)
remove(header,{'VPNavBarAppearance'})
menu=header.find('VPNavBarMenu')
telegram=Parser();telegram.feed('<a class="VPLink link VPNavBarMenuLink english-telegram-nav" href="/telegram.html" data-telegram-link data-v-207cb7fd data-v-0d4d3bc8><span data-v-0d4d3bc8>Telegram</span></a>')
menu.children.extend(telegram.root.children)
# Add project-specific destinations using the same source sidebar item markup.
def item(label,href,icon='books',identity=''):
 return '<div class="VPSidebarItem level-1 is-link" data-v-9f71b922><div class="item" data-v-9f71b922><div class="indicator" data-v-9f71b922></div><a class="VPLink link" href="'+href+'" '+('id="'+identity+'" 'if identity else '')+'data-v-9f71b922><p class="text" data-v-9f71b922><span class="sb-icon" data-tone="lavender" aria-hidden="true"><img src="/icons/'+icon+'.svg" alt="" width="18" height="18"></span><span class="sb-label">'+label+'</span></p></a></div></div>'
def group(label,inner):return '<div class="no-transition group" data-v-9994529b><section class="VPSidebarItem level-0" data-v-9994529b data-v-9f71b922><div class="item" data-v-9f71b922><div class="indicator" data-v-9f71b922></div><h2 class="text" data-v-9f71b922>'+label+'</h2></div><div class="items" data-v-9f71b922>'+inner+'</div></section></div>'
groups=[n for n in sidebar.find('nav').children if isinstance(n,Node) and n.has('group')]
lesson=Parser();lesson.feed(item('Первый урок с ИИ','/ai.html','robot'))
groups[1].find('items').children.insert(0,lesson.root.children[0])
alltools=Parser();alltools.feed(item('Все инструменты','/links/all-tools.html','globe-with-meridians'))
grammar=Parser();grammar.feed(item('Грамматика','/links/grammar.html','notebook'))
groups[0].find('items').children.insert(0,alltools.root.children[0])
groups[0].find('items').children.extend(grammar.root.children)
s=sidebar.html();s=s.replace('</nav>',group('О проекте',item('Блог','/materials.html','open-book')+item('Как пользоваться','/guide.html','compass')+item('Частые вопросы','/faq.html','speech-balloon')+item('О проекте','/about.html','books')+item('Больше в Telegram','/telegram.html','left-speech-bubble'))+'</nav>')
s=s.replace('</div></section></div><div class="no-transition group"',item('Первый урок с ИИ','/ai.html','robot')+'</div></section></div><div class="no-transition group"',1) if False else s
# Separate local role sidebar. Opposite role is never included.
role={
 'student':group('Ваше обучение',item('Следующее занятие','#student-lesson','books')+item('Домашнее задание','#student-homework','memo')+item('Повторение','#student-materials','open-book')),
 'teacher':group('Рабочий день',item('Расписание','#teacher-schedule','books')+item('Ученики','#teacher-students','speech-balloon')+item('Задать ДЗ','#teacher-task-panel','memo','teacher-task-nav')+item('Проверка ответов','#teacher-review','check-mark-button'))}
# Wrap role nav identically to the source sidebar.
def role_wrap(inner):return '<aside class="VPSidebar" data-v-49b94f76 data-v-d29ff30c><div class="curtain" data-v-d29ff30c></div><nav class="nav" id="VPSidebarNav" aria-label="Учебный кабинет" tabindex="-1" data-v-d29ff30c>'+inner+'</nav></aside>'
result={'header':header.html(),'sidebar':s,'local':local.html(),'studentSidebar':role_wrap(role['student']),'teacherSidebar':role_wrap(role['teacher'])}
(ROOT/'dist/englinks-shell-markup.js').write_text("'use strict';\nwindow.englishShellMarkup = "+json.dumps(result,ensure_ascii=False)+';\n')
print('Static source shell generated',len(result['header']),len(result['sidebar']))
