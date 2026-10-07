'use strict';

const existingCategories = {
  'YouGlish':'Словари и речь','Praktika':'ИИ-практика','British Council':'Упражнения','DeepL Write':'Письмо',
  'Anki':'Словари и речь','Test-English':'Упражнения','Language Reactor':'Видео','Cambridge Dictionary':'Словари и речь',
  'Games to Learn English':'Игры','Tandem':'Общение','QuillBot':'Письмо','ELSA Speak':'Словари и речь',
  'LingQ':'Чтение','BBC Learning English':'Аудирование'
};
const existingExtraSkills = {'British Council':['Читать'],'LingQ':['Читать'],'Language Reactor':['Читать']};
const openingNames = ['ChatGPT','YouGlish','British Council','Write & Improve','Language Reactor','Anki'];
const batchSize = 6;
const library = [
  ...tools.map(item => ({name:item.name,url:item.url,category:existingCategories[item.name] || item.category,skills:[...item.skills,...(existingExtraSkills[item.name] || [])],use:item.description,first:item.start,note:item.limit})),
  ...moreTools
].sort((a,b) => {
  const aIndex = openingNames.indexOf(a.name);
  const bIndex = openingNames.indexOf(b.name);
  if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex);
  return a.name.localeCompare(b.name,'ru');
});
const dom = selector => document.querySelector(selector);
const state = {query:'',focus:'Все',visible:batchSize};
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize = value => value.toLocaleLowerCase('ru').replace(/ё/g,'е');
const host = url => new URL(url).hostname.replace(/^www\./,'');
const skillLabels = { 'Говорить': 'Говорение', 'Слушать': 'Аудирование', 'Слова': 'Лексика', 'Писать': 'Письмо', 'Читать': 'Чтение' };

function renderCard(item) {
  const skills = item.skills.slice(0,3).map(skill => `<span>${escapeHTML(skillLabels[skill] || skill)}</span>`).join('');
  return `<details class="library-item" tabindex="-1"><summary class="library-item-summary" aria-label="Подробнее о ${escapeHTML(item.name)}">
    <div class="library-item-heading"><div class="library-item-title"><span class="library-item-logo" aria-hidden="true"><img src="${resourceIconPath(item.url)}" width="38" height="38" alt="" loading="lazy"></span><div><span class="library-item-category">${escapeHTML(item.category)}</span><h3>${escapeHTML(item.name)}</h3><span class="library-item-domain">${escapeHTML(host(item.url))}</span></div></div><span class="library-item-arrow" aria-hidden="true">↓</span></div>
    <p class="library-item-use">${escapeHTML(item.description || item.use)}</p>
    <div class="library-item-bottom"><div class="library-item-skills">${skills}</div><span class="library-item-more">Подробнее</span></div>
    </summary><div class="library-item-details"><strong>С чего начать</strong><p>${escapeHTML(item.first)}</p><strong>Что учесть</strong><p>${escapeHTML(item.note)}</p><a href="${item.url}" target="_blank" rel="noopener noreferrer">Перейти на сайт ↗</a></div>
  </details>`;
}
function render() {
  const query = normalize(state.query.trim());
  const found = library.filter(item => (state.focus === 'Все' || (state.focus === 'ИИ' ? item.category === 'ИИ-практика' : item.skills.includes(state.focus))) && (!query || normalize([item.name,item.category,item.description || item.use,...item.skills].join(' ')).includes(query)));
  const shown = found.slice(0,state.visible);
  dom('#library-grid').innerHTML = shown.map(renderCard).join('');
  dom('#library-result-count').textContent = `Найдено ${found.length} · показано ${shown.length}`;
  const remaining = found.length - shown.length;
  dom('#library-more-wrap').hidden = found.length <= batchSize;
  dom('#library-more').textContent = remaining ? 'Показать ещё' : 'Свернуть';
  dom('#library-more').dataset.action = remaining ? 'more' : 'collapse';
  dom('#library-empty').hidden = found.length > 0;
  dom('#library-reset').hidden = !query && state.focus === 'Все';
  document.querySelectorAll('[data-focus]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.focus === state.focus)));
}
function reset() {state.query='';state.focus='Все';state.visible=batchSize;dom('#library-search').value='';render();}
dom('#library-total').textContent = library.length;
dom('#library-search').addEventListener('input',event => {state.query=event.target.value;state.visible=batchSize;render();});
document.querySelectorAll('[data-focus]').forEach(button => button.addEventListener('click',() => {state.focus=button.dataset.focus;state.visible=batchSize;render();}));
dom('#library-more').addEventListener('click',() => {
  if (dom('#library-more').dataset.action === 'collapse') {
    state.visible = batchSize;
    render();
    dom('.library-browser').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    return;
  }
  const firstNew = state.visible;
  state.visible += batchSize;
  render();
  dom('#library-grid').children[firstNew]?.focus({preventScroll:true});
});
dom('#library-reset').addEventListener('click',reset);
dom('#library-empty-reset').addEventListener('click',() => {reset();dom('#library-search').focus();});
document.addEventListener('keydown',event => {if(event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){event.preventDefault();dom('#library-search').focus();}});
render();
