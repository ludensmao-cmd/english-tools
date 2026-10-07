'use strict';

const $ = selector => document.querySelector(selector);
const batchSize = 6;
const originalTools = [
  ...tools,
  ...moreTools.map(item => ({
    name: item.name, url: item.url,
    category: item.category, kind: '', skills: item.skills,
    price: '', description: item.description, start: item.first, limit: item.note
  }))
];
function canonicalResourceUrl(value) {
  try {
    const url = new URL(value);
    url.protocol = 'https:';
    url.hostname = url.hostname.replace(/^www\./, '');
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'referral', 'affiliate', 'aff', 'fbclid', 'gclid'].forEach(key => url.searchParams.delete(key));
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    return url.toString();
  } catch { return value; }
}
function cleanResourceUrl(value) {
  try {
    const url = new URL(value);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref','referral','affiliate','aff','fbclid','gclid'].forEach(key=>url.searchParams.delete(key));
    return url.toString();
  } catch { return value; }
}
const catalogTools = [];
const mergedResources = new Map();
for (const item of [...originalTools.map(tool => ({...tool, original:true, sections:['originals'], subcategories:[]})), ...(typeof englinksTools !== 'undefined' ? englinksTools : [])]) {
  const key = canonicalResourceUrl(item.url);
  const existing = mergedResources.get(key);
  if (existing) {
    existing.sections = [...new Set([...(existing.sections || []), ...(item.sections || [])])];
    existing.subcategories = [...new Set([...(existing.subcategories || []), ...(item.subcategories || [])])];
    existing.skills = [...new Set([...existing.skills, ...(item.skills || [])])];
    existing.sourcePages = [...new Set([...(existing.sourcePages || []), ...(item.sourcePages || [])])];
    existing.aliases = [...new Set([...(existing.aliases || []), item.name, ...(item.aliases || [])])];
    existing.sourceUrls = [...new Set([existing.url, ...(existing.sourceUrls || []), cleanResourceUrl(item.url), ...(item.sourceUrls || []).map(cleanResourceUrl)])];
    if (new URL(item.url).hash && !new URL(existing.url).hash) existing.url = cleanResourceUrl(item.url);
  } else {
    const tool = {...item, url:cleanResourceUrl(item.url), sections:item.sections || [], subcategories:item.subcategories || [], skills:item.skills || [], sourceUrls:[...new Set([cleanResourceUrl(item.url), ...(item.sourceUrls || []).map(cleanResourceUrl)])]};
    mergedResources.set(key, tool);
    catalogTools.push(tool);
  }
}
const sectionLabels = {featured:'С чего начать',reading:'Чтение',listening:'Аудирование',vocabulary:'Слова и словари','watch-youtube':'YouTube','watch-courses':'Курсы','watch-cinema':'Кино и ТВ',speaking:'Говорение',writing:'Письмо',originals:'Ещё инструменты'};
const initialSection = new URLSearchParams(location.search).get('section') || '';
const openingNames = ['British Council', 'EF SET', 'Lingualeo', 'Duolingo', 'HelloTalk', 'ChatGPT'];
catalogTools.sort((a, b) => {
  const left = openingNames.indexOf(a.name);
  const right = openingNames.indexOf(b.name);
  return (left < 0 ? Infinity : left) - (right < 0 ? Infinity : right) || 0;
});
const state = { skill: 'Любой навык', query: '', visible: batchSize, section:sectionLabels[initialSection] ? initialSection : '', topic:'' };
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M8 6h10v10"/></svg>';
const skillLabels = { 'Говорить': 'Говорение', 'Слушать': 'Аудирование', 'Слова': 'Лексика', 'Писать': 'Письмо', 'Читать': 'Чтение' };
const normalize = value => String(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');
const searchAliases = [
  { pattern:/podcast|подкаст/, words:'подкаст подкасты podcast podcasts аудио' },
  { pattern:/dictionary|dictionaries|словар/, words:'словарь словари dictionary dictionaries' },
  { pattern:/pronunciation|произнош|фонетик/, words:'произношение произношения pronunciation фонетика' },
  { pattern:/grammar|грамматик/, words:'грамматика грамматики grammar' },
  { pattern:/listening|аудирован|слушать/, words:'аудирование слушать listening' },
  { pattern:/vocabulary|лексик|слова/, words:'лексика словарный запас vocabulary слова' },
  { pattern:/reading|читать|чтение/, words:'чтение читать reading тексты' },
  { pattern:/video|видео|субтитр|фильм|сериал/, words:'видео video videos субтитры фильмы сериалы' },
  { pattern:/chatgpt|claude|gemini|нейросет|(?:^|\s)ии(?:\s|-)|искусственн/, words:'ии ai нейросеть нейросети' }
];

function fitsDirection(tool) {
  if (state.skill === 'Любой навык') return true;
  if (state.skill === 'Видео') return tool.category === 'Видео' || /видео|фильм|сериал|субтитр|video/i.test([tool.kind, tool.description].join(' '));
  return tool.skills.includes(state.skill);
}

function filteredTools() {
  const words = normalize(state.query.trim()).split(/\s+/).filter(Boolean);
  return catalogTools.filter(tool => {
    if (!fitsDirection(tool)) return false;
    if (state.section && !tool.sections.includes(state.section)) return false;
    if (state.topic && !tool.subcategories.includes(state.topic)) return false;
    const base = normalize([tool.name, tool.category, tool.kind, tool.description, tool.start, ...(tool.aliases || []), ...tool.subcategories, ...tool.sections.map(section => sectionLabels[section] || section), ...tool.skills, ...tool.skills.map(skill => skillLabels[skill] || skill)].join(' '));
    const haystack = `${base} ${searchAliases.filter(alias => alias.pattern.test(base)).map(alias => alias.words).join(' ')}`;
    return words.every(word => haystack.includes(word));
  });
}

function card(tool) {
  const skills = tool.skills.slice(0, 2).map(skill => `<span>${escapeHTML(skillLabels[skill] || skill)}</span>`).join('');
  return `<details class="tool-card" tabindex="-1"><summary class="tool-card-summary" aria-label="Подробнее о ${escapeHTML(tool.name)}">
    <div class="tool-card-head"><span class="tool-logo" aria-hidden="true"><img src="${resourceIconPath(tool.url)}" width="38" height="38" alt="" loading="lazy"></span><div><span class="tool-category">${escapeHTML(tool.category)}</span><h3>${escapeHTML(tool.name)}</h3></div></div>
    ${tool.kind ? `<p class="tool-kind">${escapeHTML(tool.kind)}</p>` : ''}
    <p class="tool-description">${escapeHTML(tool.description)}</p>
    <div class="tool-skills">${skills}</div>
    <div class="tool-card-footer${tool.price ? '' : ' no-access'}">${tool.price ? `<span class="access-label${tool.free ? ' free' : ''}">${escapeHTML(tool.price)}</span>` : ''}<span class="tool-open-label">Подробнее <span aria-hidden="true">↓</span></span></div>
    </summary><div class="tool-expanded"><div class="tool-detail-body"><strong>С чего начать</strong><p>${escapeHTML(tool.start)}</p><strong>Что учесть</strong><p>${escapeHTML(tool.limit)}</p>${(tool.sourceUrls || []).filter(url => url !== tool.url).length ? `<div class="tool-source-links"><strong>Другие ссылки на этот ресурс</strong>${tool.sourceUrls.filter(url => url !== tool.url).map((url,index) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Открыть вариант ${index + 1} ↗</a>`).join('')}</div>` : ''}</div><a class="tool-external" href="${escapeHTML(tool.url)}" target="_blank" rel="noopener noreferrer">Перейти на сайт ${arrow}</a></div>
  </details>`;
}

function render() {
  const found = filteredTools();
  const shown = found.slice(0, state.visible);
  $('#tool-grid').innerHTML = shown.map(card).join('');
  $('#result-count').textContent = `Показано ${shown.length} из ${found.length} ресурсов`;
  const remaining = found.length - shown.length;
  $('#catalog-more-wrap').hidden = found.length <= batchSize;
  $('#catalog-more').textContent = remaining ? 'Показать ещё' : 'Свернуть';
  $('#catalog-collapse').hidden = state.visible <= batchSize || !remaining;
  $('#empty').hidden = found.length !== 0;
  $('#reset').hidden = state.skill === 'Любой навык' && !state.query.trim() && !state.section && !state.topic;
  $('#all-sections').hidden = !state.section;
  document.querySelectorAll('[data-section]').forEach(link => {
    if (link.dataset.section === state.section) link.setAttribute('aria-current','true'); else link.removeAttribute('aria-current');
  });
  $('#catalog-title').textContent = state.section ? sectionLabels[state.section] : 'Инструменты под задачу';
  $('#random-tool').disabled = found.length === 0;
  document.querySelectorAll('[data-skill]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.skill === state.skill)));
  document.querySelectorAll('[data-quick]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.quick === state.skill)));
}

function reset() {
  Object.assign(state, { skill: 'Любой навык', query: '', visible: batchSize, section:'', topic:'' });
  syncSectionUrl();
  updateTopics();
  $('#catalog-search').value = '';
  render();
}

function selectSkill(skill) {
  Object.assign(state, { skill, query: '', visible: batchSize, section:'', topic:'' });
  syncSectionUrl();
  updateTopics();
  $('#catalog-search').value = '';
  render();
  $('#catalog').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function syncSectionUrl() {
  const url = new URL(location.href);
  if (state.section) url.searchParams.set('section',state.section); else url.searchParams.delete('section');
  history.replaceState(null,'',url);
}
function updateTopics() {
  const topics = [...new Set(catalogTools.filter(tool => !state.section || tool.sections.includes(state.section)).flatMap(tool => tool.subcategories))].sort((a,b)=>a.localeCompare(b,'ru'));
  $('#catalog-topic').innerHTML = '<option value="">Все темы</option>' + topics.map(topic => `<option value="${escapeHTML(topic)}">${escapeHTML(topic)}</option>`).join('');
  $('#catalog-topic').value = state.topic;
}
$('#catalog-topic').addEventListener('change',event=> { state.topic=event.target.value; state.visible=batchSize; render(); });
$('#all-sections').addEventListener('click',()=>{ state.section=''; state.topic=''; state.visible=batchSize; syncSectionUrl(); updateTopics(); render(); });
document.querySelectorAll('[data-section]').forEach(link=>link.addEventListener('click',event=>{
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
  event.preventDefault();
  Object.assign(state,{section:link.dataset.section,topic:'',skill:'Любой навык',query:'',visible:batchSize});
  $('#catalog-search').value='';
  syncSectionUrl(); updateTopics(); render();
}));
$('#catalog-search').addEventListener('input', event => {
  state.query = event.target.value;
  state.visible = batchSize;
  render();
});
document.querySelectorAll('[data-skill]').forEach(button => button.addEventListener('click', () => { state.skill = button.dataset.skill; state.visible = batchSize; render(); }));
document.querySelectorAll('[data-quick]').forEach(button => button.addEventListener('click', () => selectSkill(button.dataset.quick)));
$('#reset').addEventListener('click', reset);
$('#empty-reset').addEventListener('click', () => { reset(); $('#catalog-search').focus(); });
$('#catalog-more').addEventListener('click', () => {
  const foundCount = filteredTools().length;
  if (state.visible >= foundCount) {
    state.visible = batchSize;
    render();
    $('#catalog').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    return;
  }
  const firstNew = state.visible;
  state.visible += batchSize;
  render();
  const card = $('#tool-grid').children[firstNew];
  card?.focus({ preventScroll: true });
  card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
});

$('#catalog-collapse').addEventListener('click',()=> { state.visible=batchSize; render(); $('#catalog').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); });

$('#random-tool').addEventListener('click', () => {
  const found = filteredTools();
  if (!found.length) return;
  const index = Math.floor(Math.random() * found.length);
  state.visible = Math.max(state.visible, (Math.floor(index / batchSize) + 1) * batchSize);
  render();
  const chosen = $('#tool-grid').children[index];
  if (!chosen) return;
  chosen.open = true;
  chosen.querySelector('summary')?.focus({ preventScroll: true });
  chosen.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
});

document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
    event.preventDefault();
    $('#catalog-search').focus();
  }
});

updateTopics();
render();
