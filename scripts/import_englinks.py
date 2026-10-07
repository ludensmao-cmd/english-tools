#!/usr/bin/env python3
"""Read public Englinks category snapshots; preserve full resource URL coverage.
Source texts stay in the research snapshot; the UI uses original Russian summaries.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from collections import Counter
import json, re, hashlib, datetime
ROOT=Path(__file__).resolve().parents[1]
RESEARCH=ROOT/'research'/'englinks'
PAGES={
'featured-links':'featured','reading':'reading','listening':'listening',
'social-media':'social-media','speaking':'speaking','vocabulary':'vocabulary',
'watch/cinema-tv':'watch-cinema','watch/courses':'watch-courses','watch/youtube':'watch-youtube','writing':'writing'}
TRACKERS={'utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref','referral','affiliate','aff','fbclid','gclid'}
def clean_url(url):
    p=urlparse(url)
    return urlunparse((p.scheme,p.netloc,p.path,p.params,urlencode([(k,v) for k,v in parse_qsl(p.query,keep_blank_values=True) if k not in TRACKERS]),p.fragment))
def canonical_url(url):
    p=urlparse(clean_url(url)); host=p.netloc.lower().removeprefix('www.')
    return urlunparse(('https',host,p.path.rstrip('/') or '/',p.params,p.query,''))
class Cards(HTMLParser):
    def __init__(self,page,section):
        super().__init__(convert_charrefs=True); self.page=page; self.section=section; self.cards=[]; self.headings=[]; self.heading=None; self.card=None; self.desc=0; self.depth=0; self.menuHeading='Dictionaries'; self.menuHeadingCapture=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); self.depth+=1
        if tag=='p' and 'dict-menu__title' in a.get('class','').split(): self.menuHeading=''; self.menuHeadingCapture=True
        if tag in ('h1','h2','h3','h4'): self.heading={'tag':tag,'id':a.get('id',''),'text':''}
        if tag=='a' and 'link-card' in a.get('class','').split():
            self.card={'name':a.get('title',''),'url':a.get('href',''),'originalUrl':a.get('href',''),'status':'unavailable' if 'is-broken' in a.get('class','').split() else 'listed','sourceId':a.get('id',''),'section':self.section,'sourcePage':self.page,'heading':self.headings[-1]['text'] if self.headings else '', 'sourceDescription':'','badges':[], 'sourceType':'catalog-card'}
        if tag=='a' and 'dict-menu__link' in a.get('class','').split():
            self.card={'name':'','url':a.get('href',''),'originalUrl':a.get('href',''),'status':'listed','sourceId':'','section':'vocabulary','sourcePage':self.page,'heading':self.menuHeading.strip(),'sourceDescription':'','badges':[], 'sourceType':'dictionary-menu'}
        if self.card and 'link-card__desc' in a.get('class','').split(): self.desc=self.depth
        if self.card and tag=='img': self.card.setdefault('sourceIcon',a.get('src',''))
    def handle_endtag(self,tag):
        if tag=='p' and self.menuHeadingCapture: self.menuHeadingCapture=False
        if self.heading and tag==self.heading['tag']:
            self.heading['text']=re.sub(r'\s+',' ',self.heading['text'].replace('\u200b','')).strip(); self.headings.append(self.heading); self.heading=None
        if self.card and self.desc and self.depth==self.desc: self.desc=0
        if self.card and tag=='a':
            if not self.card['sourceId']: self.card['sourceId']='dictionary-menu-'+re.sub('[^a-z0-9]+','-',self.card['name'].lower()).strip('-')
            self.card['name']=self.card['sourceId'].replace('-',' ').title() if self.card['status']=='unavailable' else self.card['name']; self.card['url']=clean_url(self.card['url']); self.card['sourceDescription']=re.sub(r'\s+',' ',self.card['sourceDescription']).strip(); self.cards.append(self.card); self.card=None; self.desc=0
        self.depth=max(0,self.depth-1)
    def handle_data(self,s):
        if self.menuHeadingCapture: self.menuHeading+=s
        if self.card and self.card['sourceType']=='dictionary-menu': self.card['name']+=s
        if self.heading: self.heading['text']+=s
        if self.card and self.desc: self.card['sourceDescription']+=s
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs); self.handle_endtag(tag)
def input_path(route):
    return RESEARCH/'raw'/('links_'+route.replace('/','_')+'.html')
def extract():
    pages=[]; all_cards=[]
    for route,section in PAGES.items():
        path=input_path(route); page='https://englinks.net/links/'+route
        if not path.exists(): pages.append({'url':page,'section':section,'status':'missing'}); continue
        source=path.read_text(); parser=Cards(page,section); parser.feed(source)
        (RESEARCH/(route.replace('/','-')+'.html')).write_text(source)
        pages.append({'url':page,'section':section,'status':'read','count':sum(c['sourceType']=='catalog-card' for c in parser.cards),'dictionaryMenuCount':sum(c['sourceType']=='dictionary-menu' for c in parser.cards),'headings':parser.headings,'sha256':hashlib.sha256(source.encode()).hexdigest()})
        all_cards.extend(parser.cards)
    unique={}
    for card in all_cards:
        key=canonical_url(card['url']) if card['url'] else 'unavailable:'+card['sourceId']
        if key not in unique: unique[key]={**card,'sections':[],'subcategories':[],'sourcePages':[],'aliases':[],'sourceCards':[]}
        item=unique[key]
        for dest,value in [('sections',card['section']),('subcategories',card['heading']),('sourcePages',card['sourcePage']),('aliases',card['name'])]:
            if value and value not in item[dest]: item[dest].append(value)
        if not item['sourceDescription'] and card['sourceDescription']: item['sourceDescription']=card['sourceDescription']
        item['sourceCards'].append({k:card[k] for k in ('sourcePage','sourceId','name','heading','url','originalUrl','status','sourceType')})
    raw={'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pages':pages,'cardOccurrences':sum(c['sourceType']=='catalog-card' for c in all_cards),'dictionaryMenuOccurrences':sum(c['sourceType']=='dictionary-menu' for c in all_cards),'sourceOccurrences':len(all_cards),'uniqueResources':len(unique),'resources':list(unique.values())}
    (RESEARCH/'resources-source.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'pages':[(p['section'],p['status'],p.get('count')) for p in pages],'occurrences':len(all_cards),'unique':len(unique)},ensure_ascii=False))
    return raw
SECTION_LABELS={'featured':'С чего начать','reading':'Чтение','listening':'Аудирование','vocabulary':'Лексика','watch-youtube':'Видео','watch-courses':'Курсы','watch-cinema':'Кино и ТВ','speaking':'Говорение','writing':'Письмо','social-media':'Соцсети'}
SECTION_SKILLS={'reading':['Читать','Слова'],'listening':['Слушать','Слова'],'vocabulary':['Слова'],'watch-youtube':['Слушать','Слова'],'watch-courses':['Грамматика','Слушать','Слова'],'watch-cinema':['Слушать','Слова'],'speaking':['Говорить','Слушать'],'writing':['Писать','Грамматика'],'social-media':['Читать','Слова'],'featured':['Слова']}
TOPICS=[
(r'pronunciation|accent|intonation','произношение и интонация'),(r'idiom|slang|everyday|daily life|daily conversation|real.life|spoken english','повседневная речь'),
(r'grammar|grammatical','грамматика'),(r'vocabulary|word use|word usage|words|word differences','лексика'),
(r'physic|chemistry|science|scientific|neuroscience','наука'),(r'space|astronomy|nasa','космос'),(r'technology|tech |gadgets|smartphone|developer|devops|kubernetes|docker|ai\b','технологии'),
(r'histor|ancient|civilization','история'),(r'culture|cultural|societ|social trends','культура и общество'),(r'psychology|human behavior|mental|self.awareness|emotional','психология'),
(r'business|entrepreneur|management|leadership|strategy|corporate','работа и бизнес'),(r'economy|economic|finance|financial|money|real estate','экономика и финансы'),
(r'health|healthy|medicine|medical','здоровье'),(r'nature|natural world|planet|wildlife|animal|oceans|environment','природа'),(r'philosoph|objectivism|life.s meaning','философия'),
(r'recipe|cooking|cuisine|cake|food|baking','еда и рецепты'),(r'sport|football|basketball|trick shots','спорт'),(r'fashion|beauty','мода'),
(r'film|movie|cinema|tv |series|cartoon|animation','кино и сериалы'),(r'book|literary|literature|poem|poetry','книги и литература'),(r'news|headlines|journalism|politic|current event','новости'),
(r'ielts','IELTS'),(r'toefl','TOEFL'),(r'academic|research|dissertation|theses','академический английский'),
(r'productivity|personal growth|habit|career|motivation','работа и личные привычки'),(r'family|friendship|relationship|teen|school life','семья и отношения'),
(r'music|song|lyrics','музыка'),(r'legal|lawyer|police|criminal|crime','право и расследования'),(r'game|puzzle|solitaire|quiz|crossword','игры и викторины')]
def topics_for(source):
    text=source.lower(); found=[]
    for pattern,label in TOPICS:
        if re.search(pattern,text) and label not in found: found.append(label)
    return found[:3]
def join_topics(topics):
    if not topics: return 'разные повседневные темы'
    return ', '.join(topics[:-1])+(' и ' if len(topics)>1 else '')+topics[-1]
def description_for(item,section,heading,adaptation):
    for alias in [item['name']]+item['aliases']:
        if alias in adaptation['specific']: return adaptation['specific'][alias]
    name=item['name']; source=item.get('sourceDescription',''); topics=topics_for(source); themes=join_topics(topics)
    if section=='reading':
        if heading in ('Книги','Аудиокниги и архивы'):
            return f'{name} даёт материал для чтения англоязычных книг и историй. Выберите знакомый сюжет и разбирайте по небольшому отрывку, сохраняя выражения в контексте.'
        if heading=='Помощники для чтения' or re.search('assistant|summar|simplif|translat',source,re.I):
            return f'{name} помогает работать с английским текстом и разбирать трудные места. Используйте подсказки после собственной попытки понять абзац и сравнивайте их с исходной формулировкой.'
        if re.search('quizzes|exercise|worksheet|lessons|passages|learning portal|test|exam',source,re.I):
            return f'{name} предлагает учебные материалы для чтения; среди тем — {themes}. После текста можно проверить понимание и перенести несколько выражений в собственный пересказ.'
        return f'{name}: англоязычное чтение на темы «{themes}». Материал можно использовать для разбора аргументов, поиска полезных выражений и короткого пересказа своими словами.'
    if section=='listening':
        if re.search('audiobook|audio.book',source,re.I):
            return f'{name} предлагает аудиокниги для слушания на английском. Выберите знакомую историю и возвращайтесь к одному фрагменту, пока не сможете пересказать основное событие.'
        if re.search('podcast app|platform for listening|podcasts and radio|podcast platform|ios.s default app',source,re.I):
            return f'{name} — инструмент для выбора и прослушивания англоязычных передач. Подбирайте короткие выпуски по своим интересам и сохраняйте выражения из услышанного разговора.'
        if re.search('interactive|quizzes|exercise|learning resource|lessons',source,re.I):
            return f'{name} использует аудио и учебные материалы для практики понимания речи. Здесь можно разбирать темы «{themes}» и проверять детали после повторного прослушивания.'
        return f'{name}: англоязычные разговоры и рассказы на темы «{themes}». Слушайте ради содержания, затем возвращайтесь к одной реплике и пробуйте повторить мысль своим языком.'
    if section=='vocabulary':
        if heading in ('Учебные словари','Словари','Ещё словари') or re.search('dictionary|thesaurus|etymology',source,re.I):
            return f'{name} — справочник для работы со значениями английских слов и примерами употребления. Сверяйте нужное значение с вашей фразой и сохраняйте слово вместе с контекстом.'
        if heading=='Перевод и контекст':
            return f'{name} помогает сопоставлять слова и выражения на разных языках. Используйте перевод как подсказку, а затем проверяйте английскую формулировку в примере целого предложения.'
        if heading=='Синонимы и история слов':
            return f'{name} помогает исследовать связанные английские слова и сравнивать их значения. Выбирайте вариант по смыслу и стилю своего предложения, а не только по близости перевода.'
        if heading in ('Частотные списки слов','Лексика для учёбы и экзаменов') or re.search('word list|words selected|lexicon|vocabulary list',source,re.I):
            return f'{name} — список лексики для выборочной работы со словами. Отмечайте уже знакомые выражения и отбирайте новые под свою учебную задачу; полезнее небольшой набор с примерами, чем весь список сразу.'
        if heading=='Карточки и повторение' or re.search('flashcard|spaced repetition|srs',source,re.I):
            return f'{name} помогает повторять английскую лексику через карточки и задания. Сохраняйте выражения со своими примерами и проверяйте, получается ли вспомнить их без перевода и подсказок.'
        if heading=='Словосочетания' or re.search('collocation|word combination',source,re.I):
            return f'{name} посвящён сочетаниям английских слов. Сравнивайте готовые связки и пробуйте употребить выбранное выражение в собственном письме или разговоре.'
        if heading=='Игры и головоломки' or re.search('game|puzzle|quiz',source,re.I):
            return f'{name} предлагает словесные игры и задания на узнавание английской лексики. После одного раунда разберите незнакомые ответы и используйте несколько слов вне игры.'
        if heading=='Слова в контексте' or re.search('context|sentence|corpus|clip',source,re.I):
            return f'{name} помогает замечать английские слова в контексте и сравнивать варианты употребления. Найдите нужное выражение и перенесите подходящий образец в собственную фразу.'
        return f'{name} предлагает материалы для работы с английской лексикой. Выберите одну знакомую тему, повторите нужные слова и составьте несколько предложений о своей ситуации.'
    if section=='watch-youtube':
        if heading=='Обучение английскому':
            return f'{name}: видео об английском, в том числе о темах «{themes}». Разберите одну реплику или объяснение и сразу попробуйте применить его в своём примере.'
        return f'{name}: англоязычные видео на темы «{themes}». Можно тренировать понимание речи на интересном содержании: выбрать короткий фрагмент, проверить субтитры и пересказать главную мысль.'
    if section=='watch-courses':
        return f'{name} предлагает последовательные уроки английского. Разбирайте по одной теме, выполняйте задания и после урока составляйте собственные примеры вместо просмотра нескольких видео подряд.'
    if section=='watch-cinema':
        if 'imdb.com' not in item['url'] and not re.search(r'\([12][0-9]{3}',name):
            return f'{name} помогает использовать видео для языковой практики. Выберите короткую сцену, разберите несколько реплик и проверьте, узнаёте ли вы их на слух при повторном просмотре.'
        accent=[]
        if re.search('british|birmingham',source,re.I): accent.append('британская речь')
        if re.search('american|baltimore|southern accent',source,re.I): accent.append('американская речь')
        if re.search('fast|rapid',source,re.I): accent.append('быстрые диалоги')
        if re.search('simple|clear|slow',source,re.I): accent.append('более понятные реплики')
        detail=', '.join(accent[:2]); prefix=f'«{name}» даёт материал для слушания: {themes}' + (f'; {detail}' if detail else '') + '.'
        return prefix+' Для занятия достаточно одной сцены: разберите реплики, затем пересмотрите фрагмент без опоры на перевод.'
    if section=='speaking':
        if heading=='Языковой обмен и занятия' or re.search('exchange|live conversation|voice|speaking partners|one.on.one|community',source,re.I):
            return f'{name} предлагает разговорную практику и взаимодействие с другими участниками. Подготовьте одну знакомую тему, несколько вопросов и попробуйте поддержать диалог с уточняющими репликами.'
        if heading=='Произношение' or re.search('pronunciation|accent|shadowing|imitation',source,re.I):
            return f'{name} помогает разбирать звучание английской речи и практиковать повторение за образцом. Работайте с одной короткой репликой, обращая внимание на ритм, ударение и связь слов.'
        return f'{name} даёт темы и материалы для разговорной практики на английском. Выберите один вопрос и ответьте с примером, а затем придумайте уточняющий вопрос собеседнику.'
    if section=='writing':
        if heading=='Грамматика' or re.search('grammar guides|grammar rules|grammar exercises|grammar lessons|explanations and exercises',source,re.I):
            return f'{name} помогает разбирать английскую грамматику на объяснениях и примерах. Возьмите одну конструкцию и после упражнения используйте её в нескольких предложениях о себе.'
        if heading=='Расширения и перевод' or re.search('translator|translates|translation',source,re.I):
            return f'{name} предлагает подсказки для перевода и работы с английским текстом. Сначала сформулируйте мысль сами, затем сравните предложенный вариант и объясните каждую полезную замену.'
        return f'{name} помогает проверять и дорабатывать английские тексты. Начните с самостоятельно написанного абзаца и разберите несколько замечаний, проверяя, сохраняют ли правки нужный смысл.'
    if section=='social-media':
        platform='сообщество Reddit' if heading=='Reddit' else 'страница X / Twitter' if heading=='X / Twitter' else 'страница Instagram' if heading=='Instagram' else 'англоязычная лента'
        return f'{name} — {platform}; темы публикаций: {themes}. Возьмите одну запись для короткого чтения или слушания, затем перескажите её и сохраните полезное выражение.'
    return f'{name} — ресурс для самостоятельной практики английского. Выберите небольшой материал под свою задачу и попробуйте использовать новые выражения в собственных предложениях.'
def start_limit_for(item,section,heading):
    name=item['name']; source=item.get('sourceDescription','')
    choices={
      'reading':('Откройте один короткий текст по знакомой теме. Прочитайте без пословного перевода и перескажите основную мысль двумя-тремя предложениями.','Сложность и доступность текстов различаются. Некоторые публикации требуют аккаунта или подписки; выбирайте материал, в котором понятна основная мысль.'),
      'listening':('Выберите короткий выпуск. Сначала послушайте ради общего смысла, затем переслушайте одну минуту и запишите три выражения целиком.','Темп, акценты и доступ к тексту выпуска различаются. Если содержание почти непонятно, возьмите более короткий фрагмент или знакомую тему.'),
      'vocabulary':('Выберите пять слов под свою задачу. Найдите контекст для каждого и составьте собственные предложения, затем вернитесь к ним завтра.','У одного слова бывают разные значения. Проверяйте произношение, контекст и сочетаемость; не заменяйте близкие слова автоматически.'),
      'watch-youtube':('Откройте короткое видео на знакомую тему. Посмотрите фрагмент, проверьте трудную реплику по субтитрам и повторите её вслух.','Субтитры могут быть автоматическими и содержать ошибки. Скорость и лексика зависят от ролика; доступность YouTube зависит от региона.'),
      'watch-courses':('Выберите один урок по уровню. Выполните задание и составьте три собственных примера, затем решите, подходит ли вам порядок и темп курса.','Платформы и отдельные курсы могут требовать регистрации и оплаты. Проверьте условия конкретного курса; наличие ссылки здесь не означает бесплатного доступа.'),
      'watch-cinema':('Выберите знакомую сцену на одну-две минуты. Послушайте без перевода, разберите три реплики и пересмотрите фрагмент с английскими субтитрами.','Для произведений ссылка ведёт на информацию о фильме или сериале, а не обязательно на просмотр. Подборка по сложности — ориентир; скорость речи и нужные вам слова важнее условного уровня.'),
      'speaking':('Подготовьте небольшой рассказ о себе и два вопроса по знакомой теме. Попробуйте говорить без готового русского текста и повторите трудные реплики после разговора.','Форматы практики различаются: запись, обмен с участниками или занятия. Проверьте условия; участники сообщества не обязательно преподаватели.'),
      'writing':('Напишите пять-семь предложений самостоятельно. Разберите две подсказки, объясните каждую замену и перепишите только тот фрагмент, где она нужна.','Автоматические подсказки могут ошибаться или менять смысл. Не отправляйте конфиденциальный текст; часть функций зависит от аккаунта и тарифа.'),
      'social-media':('Выберите одну запись, прочитайте или послушайте её. Сформулируйте главную мысль своими словами и сохраните одно выражение с примером.','Публикации и комментарии создают авторы и участники платформы. Сложность и качество объяснений различаются; доступ может требовать аккаунта и зависит от региона.'),
      'featured':('Откройте материал под одну конкретную задачу. Разберите небольшой фрагмент и попробуйте использовать английский самостоятельно.','Формат, условия доступа и сложность зависят от конкретного ресурса. Начните с небольшой задачи и проверьте, подходит ли вам способ практики.')}
    start,limit=choices[section]
    if heading in ('Книги','Аудиокниги и архивы'): start='Выберите знакомую историю и откройте небольшой отрывок. Прочитайте или прослушайте его, затем перескажите главное событие без текста.'
    if heading in ('Словари','Учебные словари','Ещё словари','Синонимы и история слов'): start='Найдите слово из своего текста. Сравните значения и примеры, затем составьте собственную фразу с нужным значением.'
    if heading in ('Частотные списки слов','Лексика для учёбы и экзаменов'): start='Отметьте знакомые слова и выберите пять нужных вам новых. Найдите примеры их употребления и сохраните целые выражения для повторения.'
    if heading=='Игры и головоломки': start='Пройдите один раунд. Проверьте незнакомые ответы в словаре и составьте три короткие фразы с новыми словами.'
    if heading=='Перевод и контекст': start='Возьмите одну фразу из собственного текста. Сравните варианты перевода, затем проверьте английский вариант в словаре и примерах.'
    if 'tureng.com' in item['url'] or 'seslisozluk.net' in item['url'] or '/english-turkish' in item['url']:
        limit='Эта ссылка ведёт к ресурсу с английско-турецкими направлениями перевода. Для русскоязычной практики проверьте доступные языки и используйте английские определения и контексты там, где они есть.'
    if name=='İngilizce Taklit Dersi': limit='Объяснение техники в этом видео дано на турецком. Для самой практики подберите короткую англоязычную запись и ориентируйтесь на звучание образца.'
    if section=='watch-cinema' and 'imdb.com' not in item['url'] and not re.search(r'\([12][0-9]{3}',name):
        limit='Возможности, совместимость и условия доступа зависят от инструмента. Подписка на сервис с видео, если требуется, оформляется отдельно.'
    return start,limit
def adapt(raw):
    cfg=json.loads((RESEARCH/'russian-adaptation.json').read_text()); tools=[]; unavailable=[]; coverage=[]
    for source in raw['resources']:
        sections=source['sections'][:]
        if sections==['featured'] and source['name']=='Forvo': sections.append('speaking')
        main=next((s for s in sections if s!='featured'),'featured')
        headings=[cfg['headings'].get(h,h) for h in source['subcategories']]
        specific_cards=[c for c in source['sourceCards'] if c['sourceType']=='catalog-card' and c['sourcePage']!='https://englinks.net/links/featured-links']
        heading=cfg['headings'].get(specific_cards[0]['heading'],specific_cards[0]['heading']) if specific_cards else (headings[-1] if headings else SECTION_LABELS[main])
        item={**source}
        if source['status']=='unavailable':
            unavailable.append({'name':source['name'],'status':'unavailable','sections':sections,'sourcePages':source['sourcePages'],'limit':'В исходном каталоге ссылка помечена как недоступная; адрес не указан. Сохраняем запись отдельно без кнопки перехода.'})
            continue
        if main=='watch-cinema' and 'imdb.com' in source['url']: item['name']=re.sub(r'\s*\([12][0-9]{3}.*?\)\s*$','',item['name'])
        desc=description_for(item,main,heading,cfg); start,limit=start_limit_for(item,main,heading)
        source_urls=list(dict.fromkeys(clean_url(c['originalUrl']) for c in source['sourceCards'] if c['originalUrl']))
        name=source['name']
        if main=='watch-cinema' and 'imdb.com' in source['url']: name=re.sub(r'\s*\([12][0-9]{3}.*?\)\s*$','',name)
        record={'id':'englinks-'+hashlib.sha1(canonical_url(source['url']).encode()).hexdigest()[:12],'name':name,'url':source['url'],'category':SECTION_LABELS[main],'kind':heading,'skills':list(dict.fromkeys(s for sec in sections for s in SECTION_SKILLS[sec])),'description':desc,'start':start,'limit':limit,'sections':sections,'subcategories':list(dict.fromkeys(headings)),'sourcePages':source['sourcePages'],'sourceUrls':source_urls,'aliases':source['aliases'],'status':'listed'}
        tools.append(record)
    (ROOT/'dist'/'englinks-data.js').write_text("'use strict';\n\n// Public resource names/links from Englinks; original Russian summaries.\n// Source snapshots and complete coverage: site/research/englinks/.\nconst englinksTools = "+json.dumps(tools,ensure_ascii=False,indent=2)+";\nconst englinksUnavailable = "+json.dumps(unavailable,ensure_ascii=False,indent=2)+";\n")
    (RESEARCH/'resources-ru.json').write_text(json.dumps(tools,ensure_ascii=False,indent=2)+'\n')
    source_to_item={canonical_url(t['url']):t['id'] for t in tools}
    for item in raw['resources']:
        for source_card in item['sourceCards']:
            coverage.append({**source_card,'catalogId':source_to_item.get(canonical_url(item['url'])) if item['url'] else None,'outcome':'included' if item['url'] else 'unavailable-no-url'})
    report={'retrievedAt':raw['retrievedAt'],'sourcePageCount':len(raw['pages']),'sourcePages':[{k:v for k,v in p.items() if k!='headings'} for p in raw['pages']], 'catalogCardOccurrences':raw['cardOccurrences'],'dictionaryMenuOccurrences':raw['dictionaryMenuOccurrences'],'sourceOccurrences':raw['sourceOccurrences'],'uniqueSourceRecords':len(raw['resources']),'resourcesWithUrl':len(tools),'unavailableWithoutUrl':unavailable,'missedOccurrences':0,'license':'No content license found in current public pages; names, URLs and factual categories retained, descriptions written in original Russian wording.','coverage':coverage}
    (RESEARCH/'source-coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'frontendResources':len(tools),'unavailable':len(unavailable),'occurrenceCoverage':len(coverage),'uniqueUrls':len(source_to_item),'untranslatedHeadings':sorted(set(h for t in tools for h in t['subcategories'] if re.search('[a-z]',h) and h not in ('Spotify','YouTube','Podbean','Instagram','Reddit','X / Twitter')))},ensure_ascii=False))
    return tools

if __name__=='__main__':
    RESEARCH.mkdir(parents=True,exist_ok=True); adapt(extract())
