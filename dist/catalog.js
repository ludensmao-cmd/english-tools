/* Progressive controls for the single, statically rendered resource catalogue. */
(() => {
  'use strict';
  if (document.body.dataset.page !== 'catalog') return;
  const PAGE_SIZE = 6;
  const root = document.querySelector('.vp-doc');
  if (!root) return;
  const filterForm = document.getElementById('catalog-filter-form');
  const queryInput = document.getElementById('catalog-query');
  const skillInput = document.getElementById('catalog-skill');
  const resultsCount = document.getElementById('catalog-results-count');
  const empty = document.getElementById('catalog-empty');
  const resetButton = document.getElementById('catalog-reset');
  const skillAliases = { words: 'vocabulary', word: 'vocabulary', read: 'reading', listen: 'listening', speak: 'speaking', write: 'writing' };
  const skills = new Set(['reading', 'listening', 'speaking', 'writing', 'vocabulary', 'grammar']);
  const normalize = value => String(value || '').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim().normalize('NFKC');
  const normalizeSkill = value => {
    const skill = normalize(value);
    return skills.has(skill) ? skill : (skillAliases[skill] || '');
  };
  const groups = Array.from(root.querySelectorAll('[data-catalog-list]')).map(list => {
    const container = list.parentElement;
    const controls = container.querySelector('[data-catalog-controls]');
    const cards = Array.from(list.querySelectorAll('.link-card'));
    return {
      list, container, controls, cards,
      heading: container.previousElementSibling?.matches('[data-catalog-group-heading]') ? container.previousElementSibling : null,
      more: controls?.querySelector('[data-catalog-more]'),
      collapse: controls?.querySelector('[data-catalog-collapse]'),
      count: controls?.querySelector('[data-catalog-list-count]'),
      matches: cards,
      limit: PAGE_SIZE,
    };
  });
  const total = groups.reduce((sum, group) => sum + group.cards.length, 0);
  let query = '', skill = '';

  function renderGroup(group) {
    const visible = Math.min(group.limit, group.matches.length);
    const matching = new Set(group.matches.slice(0, visible));
    group.cards.forEach(card => { card.hidden = !matching.has(card); });
    if (filterForm) {
      group.container.hidden = !group.matches.length;
      if (group.heading) group.heading.hidden = !group.matches.length;
    }
    if (!group.controls) return;
    group.controls.hidden = !group.matches.length || group.matches.length <= PAGE_SIZE;
    group.count.textContent = 'Показано ' + visible + ' из ' + group.matches.length;
    const remaining = group.matches.length - visible;
    group.more.hidden = remaining === 0;
    group.more.textContent = 'Показать ещё';
    group.more.setAttribute('aria-label', group.more.textContent + ': ' + (group.list.dataset.catalogLabel || 'ресурсы'));
    group.collapse.hidden = visible <= PAGE_SIZE;
    group.collapse.setAttribute('aria-label', 'Свернуть: ' + (group.list.dataset.catalogLabel || 'ресурсы'));
  }

  function writeUrl() {
    const url = new URL(location.href);
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    if (skill) url.searchParams.set('skill', skill); else url.searchParams.delete('skill');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function filter(updateUrl = true) {
    query = queryInput?.value.trim().slice(0, 200) || '';
    skill = normalizeSkill(skillInput?.value);
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    let found = 0;
    groups.forEach(group => {
      group.limit = PAGE_SIZE;
      group.matches = group.cards.filter(card => {
        const text = normalize(card.dataset.catalogSearch || card.textContent);
        const tags = (card.dataset.catalogSkills || '').split(' ');
        return (!skill || tags.includes(skill)) && terms.every(term => text.includes(term));
      });
      found += group.matches.length;
      renderGroup(group);
    });
    if (resultsCount) resultsCount.textContent = query || skill ? 'Найдено ' + found + ' из ' + total + ' ресурсов' : total + ' ресурсов в каталоге';
    if (empty) empty.hidden = found > 0;
    if (resetButton) resetButton.hidden = !query && !skill;
    if (updateUrl) writeUrl();
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    queryInput.value = (params.get('q') || '').slice(0, 200);
    skillInput.value = normalizeSkill(params.get('skill'));
    filter(false);
  }

  function reset() {
    queryInput.value = '';
    skillInput.value = '';
    filter();
    queryInput.focus();
  }

  groups.forEach(group => {
    group.more?.addEventListener('click', () => {
      group.limit += PAGE_SIZE;
      renderGroup(group);
      if (group.more.hidden) group.collapse.focus();
    });
    group.collapse?.addEventListener('click', () => {
      group.limit = PAGE_SIZE;
      renderGroup(group);
      group.more.focus();
      group.list.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  });

  if (filterForm) {
    filterForm.addEventListener('submit', event => { event.preventDefault(); filter(); });
    queryInput.addEventListener('input', () => filter());
    skillInput.addEventListener('change', () => filter());
    resetButton.addEventListener('click', reset);
    document.getElementById('catalog-empty-reset')?.addEventListener('click', reset);
    window.addEventListener('popstate', readUrl);
    readUrl();
  } else {
    groups.forEach(renderGroup);
  }

  function fallback(image) {
    if (!image.getAttribute('src')?.endsWith('/brand/resource-icon.svg')) image.src = '/brand/resource-icon.svg';
  }
  root.querySelectorAll('.link-card__logo img').forEach(image => {
    image.addEventListener('error', () => fallback(image), { once: true });
    if (image.complete && image.naturalWidth === 0) fallback(image);
  });
})();
