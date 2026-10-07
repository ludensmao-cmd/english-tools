'use strict';
// Offline integration checks: inspect static HTML and exercise the real catalogue
// controls with minimal DOM objects. This script does not render or use a browser.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const {spawnSync}=require('child_process');
const dist=path.join(__dirname,'../dist');
const read=name=>fs.readFileSync(path.join(dist,name),'utf8');
const parseSource=String.raw`
import json,sys
from html.parser import HTMLParser
from pathlib import Path
class Node:
 def __init__(self,tag='root',attrs=None,parent=None):self.tag=tag;self.attrs=attrs or {};self.children=[];self.parent=parent
 def walk(self):
  yield self
  for child in self.children:
   if isinstance(child,Node):yield from child.walk()
 def text(self):return ''.join(child.text() if isinstance(child,Node) else child for child in self.children)
 def has(self,name):return name in self.attrs.get('class','').split()
 def record(self):
  record={'tag':self.tag,'attrs':self.attrs,'text':self.text()}
  if self.has('link-card'):
   record['name']=next(n.text() for n in self.walk() if n.has('link-card__title'))
   record['description']=next(n.text() for n in self.walk() if n.has('link-card__desc'))
  return record
class Parser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root]
 def handle_starttag(self,tag,attrs):
  node=Node(tag,dict(attrs),self.stack[-1]);self.stack[-1].children.append(node)
  if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(node)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  for index in range(len(self.stack)-1,0,-1):
   if self.stack[index].tag==tag:del self.stack[index:];break
 def handle_data(self,value):self.stack[-1].children.append(value)
result={}
for name in json.loads(sys.argv[2]):
 parser=Parser();parser.feed((Path(sys.argv[1])/name).read_text());nodes=list(parser.root.walk());groups=[]
 for node in nodes:
  if 'data-catalog-list' in node.attrs:
   control=next((n for n in node.parent.walk() if 'data-catalog-controls' in n.attrs),None)
   siblings=[n for n in node.parent.parent.children if isinstance(n,Node)]
   heading=next((n for n in reversed(siblings[:siblings.index(node.parent)]) if n.tag in {'h2','h3'}),None)
   groups.append({'id':node.attrs.get('id'),'label':node.attrs.get('data-catalog-label',''),'heading':heading.record() if heading else None,'folder':bool(heading and any(n.has('catalog-folder-label') for n in heading.walk())),'cards':[n.record() for n in node.walk() if n.has('link-card')],'controls':[n.attrs for n in control.walk()] if control else []})
 result[name]={'nodes':[node.record() for node in nodes],'groups':groups,'sidebarIcons':[image.attrs.get('src','') for sidebar in nodes if sidebar.has('VPSidebar') for image in sidebar.walk() if image.tag=='img']}
print(json.dumps(result,ensure_ascii=False))
`;
const routes=['all-tools','featured-links','grammar','reading','listening','speaking','vocabulary','writing','watch/youtube','watch/courses','watch/cinema-tv'];
const names=['index.html','ai.html','materials.html','telegram.html','guide.html','faq.html','about.html',...fs.readdirSync(path.join(dist,'materials')).filter(name=>name.endsWith('.html')).map(name=>'materials/'+name),...routes.map(route=>'links/'+route+'.html')];
const parsed=spawnSync('python3',['-c',parseSource,dist,JSON.stringify(names)],{encoding:'utf8',maxBuffer:20*1024*1024});
assert.strictEqual(parsed.status,0,'Static HTML extraction failed: '+parsed.stderr);
const documents=JSON.parse(parsed.stdout);
const hasClass=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name);
const classes=(document,name)=>document.nodes.filter(node=>hasClass(node,name));
const id=(document,value)=>document.nodes.find(node=>node.attrs.id===value);
const scripts=document=>document.nodes.filter(node=>node.tag==='script').map(node=>(node.attrs.src||'').split('?')[0]);
const file=reference=>path.join(dist,decodeURIComponent(new URL(reference,'https://english.tools').pathname).replace(/^\//,''));
for(const [name,document] of Object.entries(documents)) {
 const blog=document.nodes.filter(node=>node.tag==='a'&&hasClass(node,'VPNavBarMenuLink')&&node.attrs.href==='/materials.html');
 assert.strictEqual(blog.length,1,name+': Blog navigation missing');
 assert.strictEqual(blog[0].text.trim(),'Блог',name+': obsolete Materials navigation label');
 for(const nav of classes(document,'no-js-links'))assert(!nav.text.includes('Материалы'),name+': obsolete no-JS navigation label');
 if(name!=='index.html') {
  assert(classes(document,'lobby-shell').length===1,name+': public navigation theme missing');
  assert(document.nodes.some(node=>node.tag==='link'&&(node.attrs.href||'').startsWith('/lobby-shell.css?')),name+': shared navigation stylesheet missing');
  assert.strictEqual(classes(document,'VPNavBarSearch').length,0,name+': obsolete header search remains');
  assert.strictEqual(classes(document,'english-telegram-nav').length,1,name+': Telegram shortcut missing');
  assert.strictEqual(classes(document,'english-doc-footer').length,1,name+': shared footer missing or duplicated');
  for(const source of document.sidebarIcons)assert(source==='/icons/globe-with-meridians.svg'||source.startsWith('/icons/catalog-'),name+': obsolete sidebar icon '+source);
 }
}
assert.strictEqual(documents['materials.html'].nodes.find(node=>node.tag==='h1').text.replace(/\u200b/g,'').trim(),'Блог','Blog page heading is obsolete');
assert.strictEqual(documents['materials.html'].nodes.find(node=>node.tag==='title').text,'Блог — English.tools','Blog page title is obsolete');
function icons(document) {for(const image of document.nodes.filter(node=>node.tag==='img')) {assert(image.attrs.src.startsWith('/'),'Remote icon '+image.attrs.src);assert(fs.existsSync(file(image.attrs.src)),'Missing icon '+image.attrs.src);}}
function canonical(value) {
 const url=new URL(value);url.protocol='https:';url.hostname=url.hostname.replace(/^www\./,'');url.hash='';
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref','referral','affiliate','aff','fbclid','gclid'])url.searchParams.delete(key);
 url.pathname=url.pathname.replace(/\/$/,'')||'/';return url.toString();
}
const data={URL,window:{}};vm.createContext(data);
for(const name of ['englinks-data.js','ai-library-data.js'])vm.runInContext(read(name),data,{filename:name});
const catalogue=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/catalog.json'),'utf8'));
const merged=catalogue.resources,imported=vm.runInContext('englinksTools',data);
assert.strictEqual(JSON.stringify(imported),JSON.stringify(merged),'Compatibility export is not the canonical catalogue');
assert.strictEqual(data.window.englishAiLibrary.length,31,'AI topic count changed');
const urls=new Set(merged.map(item=>canonical(item.url)));assert.strictEqual(urls.size,merged.length,'Duplicate URL');
const resourcesById=new Map(merged.map(row=>[row.id,row]));assert.strictEqual(resourcesById.size,merged.length,'Duplicate resource ID');
for(const item of merged)assert(item.name&&item.description&&item.start&&item.limit&&/^https?:/.test(item.url)&&item.skills.length,'Incomplete resource '+item.name);
for(const item of merged)assert(item.placements.some(p=>p.page!=='featured-links'),'No subject category for '+item.name);
const turkish=/turkish|türk|турец|турци|ingilizce|tureng|seslisozluk|tr\.forvo|busuu\.com\/tr\/|[?&](?:hl|lang|locale|sl|tl)=tr(?:&|$)/i;
assert(!turkish.test(JSON.stringify(catalogue.resources)),'Turkish catalogue record remains');
for(const name of [...names,'englinks-search.json','englinks-data.js','englinks-shell-markup.js','ai-library.js'])assert(!turkish.test(read(name)),'Turkish public text/link remains in '+name);
const migration=JSON.parse(fs.readFileSync(path.join(__dirname,'../research/english-catalogue-migration-2026-10-07.json'),'utf8'));
const retirement=JSON.parse(fs.readFileSync(path.join(__dirname,'../research/social-export-2026-10-07.json'),'utf8'));
const socialExport=JSON.parse(fs.readFileSync(path.join(__dirname,'../test-fixtures/social-resources.json'),'utf8'));
const exportedIds=new Set(retirement.exportedIds);
assert.strictEqual(socialExport.resources.length,retirement.exported,'Incomplete social export');
assert.deepStrictEqual(new Set(socialExport.resources.map(row=>row.id)),exportedIds,'Social export ID mismatch');
assert.strictEqual(new Set(socialExport.resources.map(row=>row.url)).size,retirement.exported,'Duplicate social export URL');
for(const row of socialExport.resources)assert(!resourcesById.has(row.id)&&!urls.has(canonical(row.url)),'Exported social resource still on site: '+row.name);
assert(!catalogue.pages['social-media'],'Retired social page is active in catalogue');
assert.strictEqual(catalogue.redirects['social-media'],'/links/all-tools.html');
assert(read('links/social-media.html').includes('0;url=/links/all-tools.html'),'Old social URL does not redirect');
const old=JSON.parse(fs.readFileSync(path.join(__dirname,'../research/englinks/merged-catalog.json'),'utf8'));
const removed=migration.actions.filter(row=>row.action==='removed');
assert.deepStrictEqual(removed.map(row=>row.name).sort(),['Sesli Sözlük','Tureng']);
const russianUpdate=JSON.parse(fs.readFileSync(path.join(__dirname,'../research/russian-tools-update-2026-10-07.json'),'utf8'));
const sportsUpdate=JSON.parse(fs.readFileSync(path.join(__dirname,'../research/sports-news-update-2026-10-07.json'),'utf8'));
assert.strictEqual(merged.length,old.length-removed.length-migration.merged-retirement.exported+russianUpdate.added.length+sportsUpdate.added.length,'Migration count mismatch');
assert.strictEqual(sportsUpdate.added.length,6,'Sports news additions are incomplete');
for(const addition of sportsUpdate.added){const resource=resourcesById.get(addition.id);assert(resource&&resource.name===addition.name&&resource.url===addition.url,'Missing sports addition '+addition.name);assert.strictEqual(resource.catalogGroup,'all-tools-list-1','Sports publisher must be in Reading in the full catalogue: '+addition.name);assert(resource.placements.some(p=>p.page==='reading'&&p.group==='reading-list-2'),'Sports publisher absent from news '+addition.name);assert(resource.icon&&fs.existsSync(file(resource.icon)),'Missing publisher icon '+addition.name);}
const sportsNews=merged.flatMap(resource=>resource.placements.filter(p=>p.page==='reading'&&p.group==='reading-list-2').map(placement=>({resource,placement}))).sort((a,b)=>a.placement.order-b.placement.order);
assert.deepStrictEqual(sportsNews.slice(6,12).map(row=>row.resource.id),sportsUpdate.added.map(row=>row.id),'Sports news must follow the first six news cards');
assert.strictEqual(russianUpdate.added.length,21,'Russian additions are incomplete');
for(const addition of russianUpdate.added){const resource=resourcesById.get(addition.id);assert(resource&&resource.name===addition.name&&resource.url===addition.url,'Missing Russian addition '+addition.name);assert(resource.icon&&fs.existsSync(file(resource.icon)),'Missing product icon '+addition.name);}
for(const update of russianUpdate.updatedUrls){assert.strictEqual(resourcesById.get(update.id).url,update.url,'Russian URL was not applied: '+update.name);}
const russianSources=JSON.parse(fs.readFileSync(path.join(__dirname,'../research/russian-tools-source-2026-10-07.json'),'utf8')).resources;
assert.strictEqual(russianSources.length,50,'Russian research inventory is incomplete');
for(const source of russianSources)assert(merged.some(resource=>resource.name===(source.catalogName||source.name)),'Researched tool absent from catalogue: '+source.name);
for(const item of old){if(removed.some(row=>row.oldUrl===item.url))continue;const mapped=migration.sourceMap[canonical(item.url)];assert(resourcesById.has(mapped)||exportedIds.has(mapped),'Lost record '+item.name);}
const searchData=JSON.parse(read('englinks-search.json'));
assert.deepStrictEqual(new Set(searchData.map(row=>row.id)),new Set(resourcesById.keys()),'Search has missing or stale records');
for(const row of searchData){const resource=resourcesById.get(row.id);assert.strictEqual(row.url,resource.url);assert.strictEqual(row.name,resource.name);assert.strictEqual(row.description,resource.description);}
const dictionary=merged.filter(row=>row.dictionaryGroup),dictionaryUrls=new Set(dictionary.map(row=>row.url));
for(const [name,document] of Object.entries(documents)) {
 assert(!document.nodes.some(node=>node.tag==='a'&&node.attrs.href==='/links/social-media.html'),name+': retired social link remains');
 assert(!classes(document,'VPSidebar').some(node=>node.text.includes('Соцсети')),name+': retired social menu remains');
 const links=classes(document,'dict-menu__link');
 assert.strictEqual(links.length,dictionary.length,name+': wrong dictionary count');
 assert.deepStrictEqual(new Set(links.map(row=>row.attrs.href)),dictionaryUrls,name+': stale dictionary menu');
}
for(const entry of data.window.englishAiLibrary)for(const key of entry.fields)assert(data.window.englishAiFields[key],'Missing AI field '+key);
const home=documents['index.html'],starters=classes(home,'link-card');
assert.strictEqual(home.nodes.find(node=>node.tag==='body').attrs['data-page'],'home');
assert(!id(home,'tool-grid'),'Old homepage catalogue remains');
for(const name of ['reference','data','library-data','englinks-data','catalog'])assert(!scripts(home).includes('/'+name+'.js'),'Homepage loads obsolete catalogue engine '+name);
assert.strictEqual(starters.length,6,'Homepage must have six previews');
assert.deepStrictEqual(classes(home,'link-card__title').map(node=>node.text.replace('↗','').trim()),['British Council','Duolingo','Lingualeo','YouGlish','EF SET','HelloTalk']);
for(const card of starters)assert(urls.has(canonical(card.attrs.href)),'Homepage preview absent from catalogue');
const taskRoutes=['speaking','listening','vocabulary','writing','reading','grammar'].map(route=>'/links/'+route+'.html');
assert.deepStrictEqual(classes(home,'task-card').map(node=>node.attrs.href),taskRoutes,'Homepage native task routes changed');
for(const route of taskRoutes)assert(fs.existsSync(file(route)),'Missing task route '+route);
const search=classes(home,'home-catalog-search')[0];
assert(search&&search.tag==='form'&&search.attrs.action==='/links/all-tools.html'&&search.attrs.method==='get','Homepage search must be a native GET form');
assert.strictEqual(id(home,'home-search').attrs.name,'q','Homepage query parameter lost');icons(home);
const all=documents['links/all-tools.html'],allCards=classes(all,'link-card');
assert.strictEqual(allCards.length,merged.length,'Static catalogue count changed');
assert.deepStrictEqual(new Set(allCards.map(card=>canonical(card.attrs.href))),urls,'Static catalogue does not match dataset');
const subjectCoverage=new Set();
for(const route of routes) {
 const document=documents['links/'+route+'.html'];
 assert.strictEqual(document.nodes.find(node=>node.tag==='body').attrs['data-page'],'catalog');
 const ids=document.nodes.filter(node=>node.attrs.id).map(node=>node.attrs.id);assert.strictEqual(ids.length,new Set(ids).size,'Duplicate id in '+route);
 for(const name of ['Layout','VPNav','VPContent','VPSidebar','VPLocalNav','VPNavScreen'])assert.strictEqual(classes(document,name).length,1,route+': incorrect '+name+' count');
 assert(scripts(document).includes('/catalog.js'),route+': pagination script missing');
 assert(document.nodes.some(node=>node.tag==='link'&&(node.attrs.href||'').startsWith('/catalog-lobby.css?')),route+': catalogue theme missing');
 assert.strictEqual(classes(document,'catalog-folder-label').length,document.groups.length,route+': incomplete folder design coverage');
 for(const group of document.groups)assert(group.folder&&group.heading&&'data-catalog-group-heading' in group.heading.attrs,route+': unstyled resource group '+group.label);
 for(const card of classes(document,'link-card')) {
  assert(!('hidden' in card.attrs),'Static cards hidden without JavaScript');
  if(card.tag==='a') {assert(card.attrs['data-catalog-search']&&card.attrs['data-catalog-skills'],'Missing search metadata');assert(card.attrs.target==='_blank'&&card.attrs.rel==='noopener noreferrer','Incorrect external link attributes');const resource=resourcesById.get(card.attrs['data-resource-id']);assert(resource,route+': unknown resource');assert.strictEqual(card.attrs.href,resource.url,route+': stale URL '+resource.name);assert.strictEqual(card.name,resource.name,route+': stale title');assert.strictEqual(card.description,resource.description,route+': stale description');if(!['all-tools','featured-links'].includes(route))subjectCoverage.add(resource.id);}
  else assert(hasClass(card,'is-broken')&&!card.attrs.href,'Source card without a URL must remain visibly disabled');
 }
 const active=classes(document,'link-card').filter(row=>row.tag==='a');
 const expected=merged.filter(row=>route==='all-tools'||row.placements.some(p=>p.page===route));
 assert.strictEqual(active.length,expected.length,route+': duplicate or missing category card');
 assert.deepStrictEqual(new Set(active.map(row=>row.attrs['data-resource-id'])),new Set(expected.map(row=>row.id)),route+': membership differs from catalogue');
 for(const group of document.groups) {
  const expectedIds=merged.filter(row=>route==='all-tools'?row.catalogGroup===group.id:row.placements.some(p=>p.page===route&&p.group===group.id)).map(row=>row.id);
  assert.deepStrictEqual(new Set(group.cards.filter(row=>row.tag==='a').map(row=>row.attrs['data-resource-id'])),new Set(expectedIds),route+': incorrect group '+group.id);
 }
 icons(document);
}
assert.deepStrictEqual(subjectCoverage,new Set(resourcesById.keys()),'Resources missing from subject categories');
for(const resource of dictionary)assert(resource.placements.some(p=>p.page==='vocabulary'),'Dictionary absent from words: '+resource.name);
const reverso=merged.filter(row=>row.name==='Reverso Context');assert.strictEqual(reverso.length,1);assert.strictEqual(reverso[0].url,'https://context.reverso.net/перевод/английский-русский/');for(const page of ['vocabulary','writing'])assert(reverso[0].placements.some(p=>p.page===page),'Reverso absent from '+page);
assert(merged.some(row=>row.name==='English Imitation Lesson'),'English video was incorrectly removed because of its imported translated title');
const podcastCards=documents['links/listening.html'].groups.find(group=>group.id==='listening-list-1').cards;
const firstSpotify=podcastCards.findIndex(card=>new URL(card.attrs.href).hostname.endsWith('spotify.com'));
const isYouTube=card=>['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(new URL(card.attrs.href).hostname);
const firstYouTube=podcastCards.findIndex(isYouTube);
assert(firstYouTube>0&&firstYouTube<firstSpotify,'Standalone podcasts must precede YouTube and Spotify');
assert(podcastCards.slice(0,firstYouTube).every(card=>!isYouTube(card)&&!new URL(card.attrs.href).hostname.endsWith('spotify.com')),'YouTube or Spotify appears before standalone podcasts');
assert(podcastCards.slice(firstYouTube,firstSpotify).every(isYouTube),'Standalone podcast appears after YouTube');
assert(firstSpotify>0,'Spotify was not moved behind other platforms');
assert(podcastCards.slice(firstSpotify).every(card=>new URL(card.attrs.href).hostname.endsWith('spotify.com')),'Non-Spotify podcast follows Spotify');
assert.strictEqual(podcastCards.length-firstSpotify,retirement.spotifyPodcastsMoved,'Spotify podcast count changed');
const skills=['reading','listening','speaking','writing','vocabulary','grammar'];
for(const skill of skills)assert(allCards.some(card=>card.attrs['data-catalog-skills'].split(' ').includes(skill)),'Empty skill '+skill);
function node(dataset={}) {return {dataset,hidden:false,value:'',textContent:'',attrs:{},events:{},focused:false,addEventListener(type,callback){this.events[type]=callback;},setAttribute(key,value){this.attrs[key]=value;},getAttribute(key){return this.attrs[key];},focus(){this.focused=true;},scrollIntoView(){}};}
function setup(document,search='') {
 const filtered=Boolean(id(document,'catalog-filter-form')),nodes=new Map();
 for(const key of ['catalog-filter-form','catalog-query','catalog-skill','catalog-results-count','catalog-empty','catalog-reset','catalog-empty-reset'])if(id(document,key))nodes.set(key,node());
 const groups=document.groups.map(record=>{
  const cards=record.cards.map(card=>node({catalogSearch:card.attrs['data-catalog-search'],catalogSkills:card.attrs['data-catalog-skills']}));
  for(const key of ['data-catalog-more','data-catalog-collapse','data-catalog-list-count'])assert(record.controls.some(attrs=>key in attrs),'Missing '+key);
  const more=node(),collapse=node(),count=node(),controls=node(),heading=node(),container=node(),list=node({catalogLabel:record.label});
  controls.querySelector=selector=>({'[data-catalog-more]':more,'[data-catalog-collapse]':collapse,'[data-catalog-list-count]':count}[selector]);
  heading.matches=()=>filtered;container.previousElementSibling=heading;container.querySelector=selector=>selector==='[data-catalog-controls]'?controls:null;
  list.parentElement=container;list.querySelectorAll=selector=>selector==='.link-card'?cards:[];
  return {cards,more,collapse,count,controls,heading,container,list};
 });
 const prose=node();prose.querySelectorAll=selector=>selector==='[data-catalog-list]'?groups.map(group=>group.list):[];
 const location={href:'https://english.tools/links/all-tools.html'+search,search},window={events:{},addEventListener(type,callback){this.events[type]=callback;}};
 const context={URL,URLSearchParams,Set,console,location,window,history:{replaceState(state,title,url){location.href=new URL(url,location.href).href;location.search=new URL(location.href).search;}},document:{body:{dataset:{page:'catalog'}},querySelector:selector=>selector==='.vp-doc'?prose:null,getElementById:key=>nodes.get(key)||null}};
 vm.runInNewContext(read('catalog.js'),context,{filename:'catalog.js'});
 return {groups,nodes,location,window,visible:()=>groups.flatMap(group=>group.cards).filter(card=>!card.hidden),query(value,skill=''){nodes.get('catalog-query').value=value;nodes.get('catalog-skill').value=skill;nodes.get('catalog-query').events.input();}};
}
for(const route of routes) {
 const app=setup(documents['links/'+route+'.html']);
 assert.strictEqual(app.visible().length,app.groups.reduce((sum,group)=>sum+Math.min(6,group.cards.length),0),route+': initial pagination failed');
 for(const group of app.groups) {group.more.events.click();assert.strictEqual(group.cards.filter(card=>!card.hidden).length,Math.min(12,group.cards.length));if(group.cards.length>6){assert.strictEqual(group.collapse.hidden,false);group.collapse.events.click();assert.strictEqual(group.cards.filter(card=>!card.hidden).length,6);assert(group.more.focused);}}
}
const app=setup(all);
for(const query of ['Duolingo','Lingualeo','InOriginal','подкаст','words','British Council','YouGlish','Reverso','Пазл Инглиш','Симплер','WooordHunt','Мультитран','Билингва','Алиса','GigaChat']){app.query(query);assert(app.visible().length>0,'Search failed '+query);assert.strictEqual(new URL(app.location.href).searchParams.get('q'),query);}
app.query('Reverso');assert.strictEqual(app.visible().length,1,'Reverso search has duplicates');
const grammarMatches=merged.filter(row=>row.skills.includes('Грамматика')).length;
app.query('','grammar');assert(app.visible().length>0);assert(app.visible().every(card=>card.dataset.catalogSkills.split(' ').includes('grammar')));assert.strictEqual(app.nodes.get('catalog-results-count').textContent,`Найдено ${grammarMatches} из ${merged.length} ресурсов`);
const aliases=setup(all,'?skill=words&q=Anki');assert.strictEqual(aliases.nodes.get('catalog-skill').value,'vocabulary');assert(aliases.visible().length>0);
const invalid=setup(all,'?skill=invalid');assert.strictEqual(invalid.nodes.get('catalog-skill').value,'');
app.query('unlikely-no-resource-999');assert.strictEqual(app.visible().length,0);assert.strictEqual(app.nodes.get('catalog-empty').hidden,false);assert(app.groups.every(group=>group.container.hidden&&group.heading.hidden));
app.nodes.get('catalog-empty-reset').events.click();assert.strictEqual(app.nodes.get('catalog-empty').hidden,true);assert.strictEqual(app.nodes.get('catalog-reset').hidden,true);assert.strictEqual(app.location.search,'');assert.strictEqual(app.visible().length,36);
app.location.search='?q=YouGlish';app.location.href='https://english.tools/links/all-tools.html?q=YouGlish';app.window.events.popstate();assert.strictEqual(app.nodes.get('catalog-query').value,'YouGlish');assert.strictEqual(app.visible().length,1);
console.log(JSON.stringify({resources:merged.length,exportedSocialResources:retirement.exported,spotifyPodcastsAtEnd:podcastCards.length-firstSpotify,removedTurkishResources:removed.length,mergedAliases:migration.merged,subjectCoverage:subjectCoverage.size,dictionaries:dictionary.length,starterResources:classes(documents['links/featured-links.html'],'link-card').length,aiTopics:data.window.englishAiLibrary.length,homepagePreviews:starters.length,nativeTaskRoutes:taskRoutes.length,cataloguePages:routes.length,initialCatalogueVisible:36,grammarMatches,checks:['canonical data, search and all category groups have identical records','every retained resource has a subject category','every prior record accounted for in migration or separate export','complete social export and no exported records/menu on site','all Spotify podcasts follow every other platform','no Turkish public text, menu items or URLs','English imitation video retained','Reverso is unique and appears in vocabulary and writing','all active catalogue shells and local icons','actual catalogue search, aliases, pagination/collapse, empty/reset and popstate'],scope:'Offline source and minimal DOM checks; no browser rendering or external URL verification'},null,2));
