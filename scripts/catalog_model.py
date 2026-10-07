"""The public English catalogue: one validated source and shared card rendering."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import hashlib
import json
import re
from functools import lru_cache

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'content/catalog.json'
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
TRACKERS = {'utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref','referral','affiliate','aff','fbclid','gclid'}
SKILLS = {'Читать':'reading','Слушать':'listening','Говорить':'speaking','Писать':'writing','Слова':'vocabulary','Грамматика':'grammar'}
WORDS = {'reading':'reading read читать чтение','listening':'listening listen слушать аудирование','speaking':'speaking speak pronunciation говорить произношение','writing':'writing write писать письмо','vocabulary':'vocabulary words слова лексика','grammar':'grammar грамматика'}
TURKISH = re.compile(r'turkish|türk|турец|турци|ingilizce|tureng|seslisozluk|tr\.forvo|busuu\.com/tr/|[?&](?:hl|lang|locale|sl|tl)=tr(?:&|$)', re.I)

class Node:
    def __init__(self, tag='', attrs=None, children=None):
        self.tag=tag; self.attrs=dict(attrs or {}); self.children=list(children or [])
    def has(self, name): return name in self.attrs.get('class','').split()
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child,Node): yield from child.walk()
    def find(self, name): return next((n for n in self.walk() if n.has(name)),None)
    def text(self): return ''.join(c.text() if isinstance(c,Node) else c for c in self.children)
    def html(self):
        if not self.tag: return ''.join(c.html() if isinstance(c,Node) else c for c in self.children)
        attrs=''.join(' '+k+('="'+escape(str(v),quote=True)+'"' if v is not None else '') for k,v in self.attrs.items())
        opening='<'+self.tag+attrs+'>'
        if self.tag in VOID:return opening
        raw=self.tag in {'script','style'}
        return opening+''.join(c.html() if isinstance(c,Node) else (c if raw or c.startswith('<!--') else escape(c,quote=False)) for c in self.children)+'</'+self.tag+'>'

class Parser(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.root=Node(); self.stack=[self.root]
    def handle_starttag(self,tag,attrs):
        node=Node(tag,attrs); self.stack[-1].children.append(node)
        if tag not in VOID:self.stack.append(node)
    def handle_startendtag(self,tag,attrs): self.handle_starttag(tag,attrs); self.handle_endtag(tag)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:del self.stack[i:];break
    def handle_data(self,data):self.stack[-1].children.append(data)
    def handle_comment(self,data):self.stack[-1].children.append('<!--'+data+'-->')

def parse(path):
    parser=Parser(); parser.feed(path.read_text()); return parser.root

def canonical(url):
    p=urlsplit(url)
    query=urlencode([(k,v) for k,v in parse_qsl(p.query,keep_blank_values=True) if k not in TRACKERS])
    return urlunsplit(('https',p.netloc.lower().removeprefix('www.'),p.path.rstrip('/') or '/',query,''))

def resource_id(url):return 'tool-'+hashlib.sha1(canonical(url).encode()).hexdigest()[:12]

def podcast_priority(url):
    host=(urlsplit(url).hostname or '').removeprefix('www.')
    if host=='spotify.com' or host.endswith('.spotify.com'):return 2
    if host in {'youtube.com','youtu.be'} or host.endswith('.youtube.com'):return 1
    return 0

def load_catalog(path=CATALOG):
    data=json.loads(path.read_text());resources=data['resources'];pages=data['pages']
    ids=set();urls=set()
    for row in resources:
        if not all(row.get(k) for k in ['id','name','url','description','skills','placements']):raise ValueError('Incomplete catalogue record: '+row.get('name',''))
        if row.get('catalogGroup') not in {g['id'] for g in pages['all-tools']['groups']}:raise ValueError('Unknown all-tools group: '+row['name'])
        if any(skill not in SKILLS for skill in row['skills']):raise ValueError('Unknown skill: '+row['name'])
        if row.get('dictionaryGroup') and row['dictionaryGroup'] not in {'Учебные словари','Перевод и контекст','Синонимы и происхождение слов','Другие словари'}:raise ValueError('Unknown dictionary menu group: '+row['name'])
        if row.get('icon'):
            icon=row['icon']
            if not icon.startswith('/brand/resource-icons/') or '..' in icon or not (ROOT/'dist'/icon.lstrip('/')).is_file():raise ValueError('Invalid local product icon: '+row['name'])
        if row['id'] in ids or canonical(row['url']) in urls:raise ValueError('Duplicate catalogue record: '+row['name'])
        ids.add(row['id']);urls.add(canonical(row['url']))
        if TURKISH.search(json.dumps(row,ensure_ascii=False)):raise ValueError('Turkish-oriented public record: '+row['name'])
        actual=set()
        for placement in row['placements']:
            page=placement['page'];group=placement['group']
            if page in actual:raise ValueError('Duplicate placement on '+page+': '+row['name'])
            actual.add(page)
            if page not in pages or group not in {g['id'] for g in pages[page]['groups']}:raise ValueError('Unknown category placement: '+row['name'])
        if actual <= {'featured-links'}:raise ValueError('Resource has no subject category: '+row['name'])
    return data

def search_text(row):
    parts=[row['name'],row['description'],row.get('start',''),row.get('kind',''),row['url']]
    parts+=row.get('subcategories',[])+row.get('aliases',[])
    parts+=[WORDS[SKILLS[s]] for s in row['skills'] if s in SKILLS]
    return ' '.join(parts).lower().replace('ё','е')

@lru_cache(maxsize=2048)
def icon_for(url):
    source=(ROOT/'dist/resource-icons.js').read_text()
    files=json.loads(re.search(r'const englinksIconFiles = (\{.*?\});',source,re.S).group(1))
    host=(urlsplit(url).hostname or '').removeprefix('www.')
    while host:
        key=host.replace('.','-');file=files.get(key)
        if file and (ROOT/'dist/brand/resource-icons'/file).exists():return '/brand/resource-icons/'+file
        host=host.split('.',1)[1] if '.' in host else ''
    return '/brand/resource-icon.svg'

def card_for(row,placement=None):
    scope={'data-v-b57d5ded':None}
    body=[Node('strong',{'class':'link-card__title',**scope},[row['name']])]
    if placement and placement.get('platform'):
        body.append(Node('span',{'class':'catalog-platform',**scope},[placement['platform']]))
    body.append(Node('span',{'class':'link-card__desc',**scope},[row['description']]))
    node=Node('a',{'id':(placement or {}).get('anchor',row['id']),'href':row['url'],'target':'_blank','rel':'noopener noreferrer','class':'link-card','title':row['name'],'role':'link','data-resource-id':row['id'],'data-v-2081125e':None,**scope},[
        Node('span',{'class':'link-card__logo',**scope},[Node('img',{'src':row.get('icon') or icon_for(row['url']),'alt':'','width':'24','height':'24','loading':'lazy','decoding':'async',**scope})]),
        Node('span',{'class':'link-card__body',**scope},body),
    ])
    node.attrs['data-catalog-search']=search_text(row)
    node.attrs['data-catalog-skills']=' '.join(SKILLS[s] for s in row['skills'] if s in SKILLS)
    return node
