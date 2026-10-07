"""Apply the approved catalogue composition without changing resource records."""
import struct

INK='#cdbde8'
GLYPHS={
 'start':'<path d="m8 5 11 7-11 7Z"/>',
 'reading':'<path d="M12 6c-3-3-8-3-9-2v15c3-1 6 0 9 2 3-2 6-3 9-2V4c-1-1-6-1-9 2Zm0 0v15"/>',
 'listening':'<path d="M3 13v-1a9 9 0 0 1 18 0v1"/><rect x="3" y="12" width="4" height="9" rx="2"/><rect x="17" y="12" width="4" height="9" rx="2"/>',
 'vocabulary':'<path d="M3 20 8 4l5 16M5 14h6m3-3c5-2 7 0 7 3v6m0-5c-8-2-8 6 0 3"/>',
 'youtube':'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
 'courses':'<path d="m2 8 10-5 10 5-10 5ZM6 10v7c3 3 9 3 12 0v-7m4-2v9"/>',
 'cinema':'<path d="m3 8 17-5 1 4-17 5Zm1 4v9h17V7m-13-1 4 4m3-6 4 4"/>',
 'speaking':'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
 'writing':'<path d="m16 3 5 5-12 12-6 1 1-6Zm-2 2 5 5"/>',
 'social':'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
 'grammar':'<path d="M4 19V7m5 12V3m6 16v-8m5 8V6"/>',
 'ai':'<rect x="4" y="7" width="16" height="14" rx="3"/><path d="M12 3v4M1 12v5m22-5v5m-14 0h6"/><circle cx="9" cy="12" r=".5"/><circle cx="15" cy="12" r=".5"/>',
 'skills':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 9-9m-4 0h4v4"/>',
 'blog':'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8m-8 4h8m-8 4h5"/>',
 'guide':'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
 'faq':'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 4h.01"/>',
 'about':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
 'telegram':'<path d="m21 3-6 18-4-8-8-4 18-6Zm-10 10 6-6"/>',
}
ROUTES={
 '/links/featured-links.html':'start','/links/reading.html':'reading',
 '/links/listening.html':'listening','/links/vocabulary.html':'vocabulary',
 '/links/watch/youtube.html':'youtube','/links/watch/courses.html':'courses',
 '/links/watch/cinema-tv.html':'cinema','/links/speaking.html':'speaking',
 '/links/writing.html':'writing','/links/social-media.html':'social',
 '/links/grammar.html':'grammar','/ai.html':'ai','/ai.html?view=skills':'skills',
 '/materials.html':'blog','/guide.html':'guide','/faq.html':'faq',
 '/about.html':'about','/telegram.html':'telegram',
}
ICON_UPGRADES={
 '/brand/resource-icons/gutenberg-org.png':'/brand/resource-icons/gutenberg-org-catalog.png',
 '/brand/resource-icons/newsinlevels-com.png':'/brand/resource-icons/newsinlevels-com-catalog.png',
}

def icon_path(href):
 if href=='/links/all-tools.html':return '/icons/globe-with-meridians.svg'
 name=ROUTES.get(href)
 return '/icons/catalog-'+name+'.svg' if name else None

def ensure_icons(root):
 for name,paths in GLYPHS.items():
  svg='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="'+INK+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>\n'
  (root/'dist/icons'/('catalog-'+name+'.svg')).write_text(svg)

def prepare_header(header,Node,Parser,remove):
 remove(header,{'VPNavBarSearch'})
 for link in header.walk():
  if link.tag=='a' and link.attrs.get('href')=='/materials.html':
   next(n for n in link.walk() if n.tag=='span').children=['Блог']
 telegram=header.find('english-telegram-nav')
 if telegram:
  plane=Parser();plane.feed('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-6 18-4-8-8-4 18-6Z"/><path d="m11 13 6-6"/></svg>')
  telegram.children=plane.root.children+telegram.children
  telegram.attrs['class']='english-telegram-nav'
  telegram.attrs['aria-label']='Telegram'
  next(n for n in telegram.walk() if n.tag=='span').attrs['class']='catalog-telegram-label'
  header.find('VPNavBarMenu').children.remove(telegram)
  header.find('content-body').children.append(telegram)

def prepare_sidebar(tree,root):
 ensure_icons(root)
 for link in tree.walk():
  if link.tag!='a':continue
  path=icon_path(link.attrs.get('href',''))
  if path:
   image=next((n for n in link.walk() if n.tag=='img'),None)
   if image:image.attrs['src']=path
  label=link.find('sb-label')
  if label and link.attrs.get('href')=='/materials.html':label.children=['Блог']

def image_size(path):
 try:
  data=path.read_bytes()
  if data.startswith(b'\x89PNG\r\n\x1a\n'):return struct.unpack('>II',data[16:24])
  if data[:4]==b'\0\0\1\0':
   count=struct.unpack('<H',data[4:6])[0]
   sizes=[(data[6+i*16] or 256,data[7+i*16] or 256) for i in range(count)]
   return max(sizes,key=lambda size:min(size))
 except (OSError,IndexError,struct.error):pass
 return None

def prepare_listening_formats(body,Node):
 """Flatten listening by format, keeping every source card and URL intact."""
 if body.attrs.get('data-listening-layout')=='formats':return
 hero=body.find('category-hero')
 heading=next((n for n in hero.walk() if n.tag=='h1'),None) if hero else None
 if not heading or heading.attrs.get('id')!='listening':return
 parent=next(n for n in body.walk() if any(isinstance(c,Node) and c.attrs.get('id')=='podcast-platforms' for c in n.children))
 groups={}
 current=[]
 for child in parent.children:
  if not isinstance(child,Node):continue
  if child.tag in {'h2','h3'}:current=[child]
  elif child.tag=='p' and current:current.append(child)
  elif child.has('link-card-container') and current:
   groups[current[0].attrs['id']]=[*current,child]
   current=[]
 expected={'spotify','youtube','web-services','podbean','talks','interactive','archives'}
 if set(groups)!=expected:raise ValueError('Unexpected listening groups: '+str(set(groups)))
 podcast_container=groups['spotify'][-1]
 podcast_list=podcast_container.find('link-card-list')
 cards=[]
 for key,platform in [('spotify','Spotify'),('youtube','YouTube'),('web-services','Сайт'),('podbean','Podbean')]:
  for card in groups[key][-1].find('link-card-list').children:
   if not isinstance(card,Node) or not card.has('link-card'):continue
   label=Node('span',[('class','catalog-platform')])
   label.children=[platform]
   card_body=card.find('link-card__body')
   title=card_body.find('link-card__title')
   card_body.children.insert(card_body.children.index(title)+1,label)
   cards.append(card)
 # The old lectures group also contained short BBC podcast episodes and
 # listening-practice sites. Place those cards with their actual format.
 talks_list=groups['talks'][-1].find('link-card-list')
 exercises_list=groups['interactive'][-1].find('link-card-list')
 for card in list(talks_list.children):
  if not isinstance(card,Node) or not card.has('link-card'):continue
  resource=card.attrs.get('id','')
  if resource in {'6-minute-english','bbc-the-english-we-speak-resource-2'}:
   label=Node('span',[('class','catalog-platform')]);label.children=['Сайт']
   card_body=card.find('link-card__body');title=card_body.find('link-card__title')
   card_body.children.insert(card_body.children.index(title)+1,label)
   cards.append(card);talks_list.children.remove(card)
  elif resource in {'listen-a-minutecom','voa-learning-english'}:
   exercises_list.children.append(card);talks_list.children.remove(card)
 podcast_list.children=cards
 podcast_list.attrs['data-catalog-label']='Подкасты'
 next(n for n in podcast_container.walk() if 'data-catalog-list-count' in n.attrs).children=[str(len(cards))+' ресурсов']

 def title_node(id,text):
  node=Node('h2',[('id',id),('tabindex','-1')])
  anchor=Node('a',[('class','header-anchor'),('href','#'+id),('aria-label','Ссылка на раздел «'+text+'»')])
  anchor.children=['\u200b']
  node.children=[text,anchor]
  return node

 def description(text):
  node=Node('p');node.children=[text];return node

 formats=[
  title_node('podcast-platforms','Подкасты'),
  description('Разговоры, истории и обсуждения на английском. Площадка для прослушивания указана в каждой карточке.'),
  podcast_container,
 ]
 for key,label,text in [
  ('archives','Аудиокниги','Книги и рассказы, которые можно слушать на английском.'),
  ('talks','Выступления и лекции','Выступления, короткие лекции и объяснения на разные темы.'),
  ('interactive','Упражнения на слух','Короткие видео, аудио и задания, которые помогают понимать английскую речь.'),
 ]:
  container=groups[key][-1]
  container.find('link-card-list').attrs['data-catalog-label']=label
  count=sum(1 for n in container.find('link-card-list').children if isinstance(n,Node) and n.has('link-card'))
  next(n for n in container.walk() if 'data-catalog-list-count' in n.attrs).children=[str(count)+' ресурсов']
  formats.extend([title_node(key,label),description(text),container])
 # Old shared links still land at the podcast collection after its platform
 # headings disappear; these anchors have no visual or accessible content.
 aliases=[]
 for key in ['spotify','youtube','web-services','podbean','listening-list-2','listening-list-3','listening-list-4']:
  aliases.append(Node('span',[('id',key),('class','catalog-anchor-alias'),('aria-hidden','true')]))
 first=next(i for i,n in enumerate(parent.children) if isinstance(n,Node) and n.attrs.get('id')=='podcast-platforms')
 last=parent.children.index(groups['archives'][-1])+1
 parent.children[first:last]=[*aliases,*formats]
 heading.children=['Аудирование']+[n for n in heading.children if isinstance(n,Node) and n.has('header-anchor')]
 for anchor in heading.walk():
  if anchor.tag=='a':anchor.attrs['aria-label']='Ссылка на раздел «Аудирование»'
 intro=next((n for n in hero.walk() if n.tag=='p'),None)
 if intro:intro.children=['Подкасты, аудиокниги, лекции и упражнения на слух. Выберите, что хочется послушать.']
 body.attrs['data-listening-layout']='formats'

def prepare_catalog(body,Node,root):
 prepare_listening_formats(body,Node)
 classes=body.attrs.get('class','').split()
 if 'catalog-lobby' not in classes:classes.append('catalog-lobby')
 body.attrs['class']=' '.join(classes)
 hero=body.find('category-hero')
 heading=next((n for n in hero.walk() if n.tag=='h1'),None) if hero else None
 section=body.attrs.get('data-section','')
 aliases={'all-tools':'/links/all-tools.html','featured-links':'/links/featured-links.html','featured':'/links/featured-links.html','cinema-tv':'/links/watch/cinema-tv.html','cinema':'/links/watch/cinema-tv.html','courses':'/links/watch/courses.html','youtube':'/links/watch/youtube.html','youtube-channels':'/links/watch/youtube.html'}
 route=('/links/'+body.attrs['data-route']+'.html') if body.attrs.get('data-route') else aliases.get(section,'/links/'+section+'.html')
 if hero:
  icon=hero.find('category-hero__icon')
  image=next((n for n in icon.walk() if n.tag=='img'),None) if icon else None
  if image and icon_path(route):image.attrs['src']=icon_path(route)
 if heading and heading.attrs.get('id')=='all-tools':
  content=hero.find('category-hero__body')
  content.children=[n for n in content.children if not (isinstance(n,Node) and n.tag=='p')]
 for parent in list(body.walk()):
  heading=None
  descriptions=[]
  for child in list(parent.children):
   if not isinstance(child,Node):continue
   if child.tag in {'h2','h3'}:
    heading=child
    descriptions=[]
   elif child.tag=='p' and heading:
    descriptions.append(child)
   elif child.has('link-card-container'):
    if not heading:
     resource_list=child.find('link-card-list')
     heading=Node('h2',[('id',resource_list.attrs.get('id','resources')+'-heading')])
     heading.children=[resource_list.attrs.get('data-catalog-label','Инструменты')]
     parent.children.insert(parent.children.index(child),heading)
    heading.attrs['data-catalog-group-heading']=None
    if not heading.find('catalog-folder-label'):
     anchors=[n for n in heading.children if isinstance(n,Node) and n.has('header-anchor')]
     label=Node('span',[('class','catalog-folder-label')])
     label.children=[n for n in heading.children if n not in anchors]
     heading.children=[label,*anchors]
    for description in descriptions:
     classes=description.attrs.get('class','').split()
     if 'catalog-group-description' not in classes:classes.append('catalog-group-description')
     description.attrs['class']=' '.join(classes)
    heading=None
    descriptions=[]
   elif child.has('category-hero'):
    heading=None
    descriptions=[]
 # A parent section may introduce several h3 collections. It owns a separate
 # title and description, rather than inheriting the source's inline h2 + p.
 for parent in list(body.walk()):
  if not any(isinstance(n,Node) and n.has('link-card-container') for n in parent.children):continue
  section_description=False
  for child in parent.children:
   if not isinstance(child,Node):continue
   if child.tag in {'h2','h3'}:
    section_description='data-catalog-group-heading' not in child.attrs
    if section_description:child.attrs['data-catalog-section-heading']=None
   elif child.tag=='p' and section_description:
    classes=child.attrs.get('class','').split()
    if 'catalog-section-description' not in classes:classes.append('catalog-section-description')
    child.attrs['class']=' '.join(classes)
   else:section_description=False
 for n in list(body.walk()):
  if 'data-catalog-collapse' in n.attrs:n.children=['Свернуть']
  if n.tag=='label' and n.attrs.get('for') in {'catalog-query','catalog-skill'}:
   n.attrs['class']='catalog-visually-hidden'
   if n.attrs.get('for')=='catalog-skill':n.children=['Направление']
  if n.attrs.get('id')=='catalog-search-hint':n.attrs['class']='catalog-search-hint catalog-visually-hidden'
  if n.tag=='select' and n.attrs.get('id')=='catalog-skill':
   for option in n.children:
    if isinstance(option,Node) and option.tag=='option' and option.attrs.get('value')=='':option.children=['Все направления']
  if n.has('catalog-filter-query') and not n.find('catalog-query-icon'):
   svg=Node('svg',[('class','catalog-query-icon'),('viewBox','0 0 24 24'),('aria-hidden','true')])
   svg.children=[Node('circle',[('cx','10.5'),('cy','10.5'),('r','7.5')]),Node('path',[('d','m16 16 5 5')])]
   n.children.insert(0,svg)
  if n.has('link-card__logo'):
   image=next((image for image in n.walk() if image.tag=='img'),None)
   if not image:continue
   source=image.attrs.get('src','')
   upgrade=ICON_UPGRADES.get(source)
   if upgrade and (root/'dist'/upgrade.lstrip('/')).exists():source=upgrade;image.attrs['src']=source
   if source.endswith('/newsinlevels-com-catalog.png'):
    image.attrs['class']='catalog-symbol-left'
    size=52
   else:
    natural=image_size(root/'dist'/source.lstrip('/'))
    size=64 if not natural or min(natural)>=64 else min(32,min(natural))
   image.attrs['style']='--catalog-logo-size:'+str(size)+'px;'
