#!/usr/bin/env python3
"""Preserve the approved hero and route all resource discovery to one catalogue."""
from pathlib import Path
from html import escape
import json,re
ROOT=Path(__file__).resolve().parents[1]
s=(ROOT/'templates/home-original.html').read_text()
s=re.sub(r'  <link rel="preconnect" href="https://fonts\.[^"]+"[^>]*>\n','',s)
s=re.sub(r'  <link href="https://fonts\.googleapis\.com/[^\n]+\n','  <link rel="stylesheet" href="/home-fonts.css?v=ready-20261002">\n',s)
s=s.replace('Шрифт загружается с Google Fonts.','Шрифты и иконки загружаются из файлов сайта.')
for name in ['data','library-data','resource-icons','catalog-content','englinks-data','reference']:
 s=re.sub(r'\s*<script src="/'+name+r'\.js[^\"]*" defer></script>','',s)
s=s.replace('<html lang="ru">','<html lang="ru" class="dark">')
s=s.replace('<body id="top">','<body id="top" class="englinks-page home-page" data-page="home">\n<div id="app"><div class="Layout">')
s=re.sub(r'<header class="site-header">[\s\S]*?</header>','<!-- COMMON HEADER -->',s,count=1)
s=s.replace('<main>','<main id="VPContent" class="VPContent home-content" data-v-1fcbc27d>',1)
s=s.replace('href="#catalog">Выбрать инструмент','href="/links/featured-links.html">Выбрать инструмент',1)
s=s.replace(' Для практики можно <a href="/ai.html">собрать первый урок с ИИ</a>.','')
routes={'Говорить':'speaking','Слушать':'listening','Слова':'vocabulary','Писать':'writing','Читать':'reading','Грамматика':'grammar'}
def task(m):
 key,inner=m.groups();return '<a class="task-card" href="/links/'+routes[key]+'.html">'+inner+'</a>'
s=re.sub(r'<button class="task-card" type="button" data-quick="([^"]+)">([\s\S]*?)</button>',task,s)
data=json.loads((ROOT/'content/catalog.json').read_text())['resources']
icons=json.loads(re.search(r'const englinksIconFiles = (\{[\s\S]*?\});',(ROOT/'dist/resource-icons.js').read_text()).group(1))
from urllib.parse import urlsplit
def icon(url):
 host=urlsplit(url).hostname.removeprefix('www.')
 while host:
  key=host.replace('.','-')
  if key in icons:return '/brand/resource-icons/'+icons[key]
  host=host.split('.',1)[1] if '.' in host else ''
 return '/brand/resource-icon.svg'
selection=['British Council','Duolingo','Lingualeo','YouGlish','EF SET','HelloTalk']
chosen=[]
for name in selection:
 matches=[r for r in data if r['name'].lower()==name.lower()]
 if not matches:matches=[r for r in data if name.lower() in r['name'].lower()]
 if not matches:raise ValueError('Missing starter '+name)
 chosen.append(matches[0])
cards=[]
for r in chosen:
 cards.append('<a class="link-card" href="'+escape(r['url'],quote=True)+'" target="_blank" rel="noopener noreferrer" data-v-2081125e data-v-b57d5ded><span class="link-card__logo" data-v-b57d5ded><img src="'+icon(r['url'])+'" width="24" height="24" alt="" loading="lazy" decoding="async" data-v-b57d5ded></span><span class="link-card__body" data-v-b57d5ded><strong class="link-card__title" data-v-b57d5ded>'+escape(r['name'])+'<span class="link-card__external" aria-hidden="true" data-v-b57d5ded>↗</span></strong><span class="link-card__desc" data-v-b57d5ded>'+escape(r['description'])+'</span></span></a>')
preview='''<section class="catalog home-starters wrap" id="catalog" aria-labelledby="catalog-title"><div class="section-heading"><h2 id="catalog-title">Инструменты под задачу</h2></div><form class="home-catalog-search" action="/links/all-tools.html" method="get" role="search"><label class="catalog-search" for="home-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span class="sr-only">Поиск по всему каталогу</span><input id="home-search" name="q" type="search" placeholder="Название или задача — например, подкасты" autocomplete="off"></label><button class="button primary" type="submit">Найти</button></form><div class="link-card-container" data-v-2081125e><div class="link-card-list" data-v-2081125e>'''+''.join(cards)+'''</div></div><div class="home-catalog-action"><a class="button primary" href="/links/all-tools.html">Открыть каталог <span aria-hidden="true">→</span></a></div></section>'''
s=re.sub(r'<section class="catalog wrap"[\s\S]*?</section>',preview,s,count=1)
s=s.replace('<a href="#catalog">Все инструменты</a>','<a href="/links/all-tools.html">Все инструменты</a>')
s=s.replace('В карточках указаны назначение, первый шаг и ограничения.','У каждого ресурса есть краткое описание и прямая ссылка. Подборки разделены по задачам.')
s=s.replace('</body>','</div></div>\n</body>')
# Load the reference before incumbent homepage rules, so the approved hero keeps its type and spacing.
s=s.replace('  <link rel="stylesheet" href="/reference.css', '  <link rel="stylesheet" href="/englinks-source.css?v=ready-20261002">\n  <link rel="stylesheet" href="/reference.css',1)
s=s.replace('</head>','  <link rel="stylesheet" href="/englinks.css?v=ready-20261002">\n  <link rel="stylesheet" href="/home-ready.css?v=ready-20261002">\n  <script src="/englinks-shell.js?v=ready-20261002" defer></script>\n</head>')
# Older deep links preserve their meaning, and land on the canonical category.
redirect="""<script>const oldSection = new URLSearchParams(location.search).get('section'); const sectionRoutes={featured:'featured-links',reading:'reading',listening:'listening',vocabulary:'vocabulary','watch-youtube':'watch/youtube','watch-courses':'watch/courses','watch-cinema':'watch/cinema-tv',speaking:'speaking',writing:'writing','social-media':'all-tools',originals:'all-tools'}; if(oldSection && sectionRoutes[oldSection]) location.replace('/links/'+sectionRoutes[oldSection]+'.html');</script>"""
s=s.replace('</head>',redirect+'</head>')
s=re.sub(r'\?v=englinks-20261002','?v=ready-20261002',s)
(ROOT/'dist/index.html').write_text(s)
print('Homepage: approved hero, native category links, 6 starters, no duplicate catalogue engine')
