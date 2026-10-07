'use strict';
(() => {
  if (!document.body.classList.contains('englinks-page')) return;
  const body = document.body, root = document.documentElement;
  const markup = window.englishShellMarkup;
  const cabinet = body.dataset.cabinet === 'true';
  let layout = document.querySelector('.Layout');
  if (!layout) {
    layout = document.createElement('div'); layout.className = 'Layout';
    const content = document.querySelector('.VPContent');
    content.before(layout); layout.append(content);
  }
  const content = layout.querySelector('.VPContent');
  const hasSidebar = content.classList.contains('has-sidebar');
  if (markup && !layout.querySelector('.VPNav')) layout.insertAdjacentHTML('afterbegin', markup.header);
  if (markup && hasSidebar && !layout.querySelector('.VPSidebar')) {
    content.insertAdjacentHTML('beforebegin', markup.local + (cabinet ? markup[root.dataset.role === 'teacher' ? 'teacherSidebar' : 'studentSidebar'] : markup.sidebar));
  }
  if (cabinet) {
    layout.querySelector('.VPNavBarMenu')?.remove();
    layout.querySelector('.VPNavBarSearch')?.remove();
    const label = document.getElementById('role-label');
    if (label) { label.className = 'english-role-title'; layout.querySelector('.VPNavBar .content-body').prepend(label); }
  }
  // The selected dark palette is shared by the homepage and every inner page.
  root.classList.add('dark');
  const header = layout.querySelector('.VPNav');
  if (header && !hasSidebar) {
    header.querySelector('.VPNavBarTitle')?.classList.remove('has-sidebar');
    header.querySelector('.VPNavBar')?.classList.add('no-sidebar');
  }
  const backdrop = document.createElement('div');
  backdrop.className = 'VPBackdrop'; backdrop.setAttribute('data-v-f8745e5e',''); backdrop.hidden = true; layout.append(backdrop);
  const sidebar = layout.querySelector('.VPSidebar');
  const localButton = layout.querySelector('.VPLocalNav .menu');
  const hamburger = layout.querySelector('.VPNavBarHamburger');
  let mobileScreen = layout.querySelector('#VPNavScreen');
  function closeMenus() {
    sidebar?.classList.remove('open'); backdrop.hidden = true;
    localButton?.setAttribute('aria-expanded','false');
    if (mobileScreen) mobileScreen.hidden = true;
    hamburger?.classList.remove('active'); hamburger?.setAttribute('aria-expanded','false');
    body.style.overflow = '';
    document.querySelectorAll('.dict-menu__panel').forEach(panel => { panel.style.display = 'none'; });
    document.querySelectorAll('.dict-menu__button').forEach(button => button.setAttribute('aria-expanded','false'));
  }
  localButton?.addEventListener('click', () => {
    if (!sidebar) return;
    const open = !sidebar.classList.contains('open'); closeMenus();
    sidebar.classList.toggle('open', open); backdrop.hidden = !open; localButton.setAttribute('aria-expanded',String(open));
    if (open) { body.style.overflow = 'hidden'; sidebar.querySelector('a')?.focus(); }
  });
  backdrop.addEventListener('click', closeMenus);
  hamburger?.addEventListener('click', () => {
    if (mobileScreen && !mobileScreen.hidden) { closeMenus(); return; }
    closeMenus();
    if (!mobileScreen || !mobileScreen.children.length) {
      if (!mobileScreen) mobileScreen = document.createElement('div'); mobileScreen.id = 'VPNavScreen'; mobileScreen.className = 'VPNavScreen'; mobileScreen.setAttribute('data-v-3de96e2e','');
      const links = cabinet ? Array.from(sidebar?.querySelectorAll('a') || []) : Array.from(header.querySelectorAll('.VPNavBarMenu > a'));
      links.forEach(link => { const copy = link.cloneNode(true); copy.removeAttribute('id'); copy.className = 'VPNavScreenMenuLink'; copy.setAttribute('data-v-c187123a',''); mobileScreen.append(copy); });
      header.append(mobileScreen);
      mobileScreen.addEventListener('click', event => { if (event.target.closest('a')) closeMenus(); });
    }
    mobileScreen.hidden = false; hamburger.classList.add('active'); hamburger.setAttribute('aria-expanded','true'); body.style.overflow = 'hidden'; mobileScreen.querySelector('a')?.focus();
  });
  layout.querySelectorAll('.dict-menu__button').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation(); const panel = button.parentElement.querySelector('.dict-menu__panel');
    const open = button.getAttribute('aria-expanded') !== 'true'; closeMenus();
    panel.style.display = open ? 'grid' : 'none'; button.setAttribute('aria-expanded',String(open));
  }));
  document.addEventListener('click', event => { if (!event.target.closest('.dict-menu')) layout.querySelectorAll('.dict-menu__panel').forEach(panel => { panel.style.display = 'none'; panel.parentElement.querySelector('button').setAttribute('aria-expanded','false'); }); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const returnTarget = !mobileScreen?.hidden ? hamburger : (sidebar?.classList.contains('open') ? localButton : layout.querySelector('.dict-menu__button[aria-expanded="true"]'));
    closeMenus(); returnTarget?.focus();
  });
  layout.querySelector('.VPLocalNavOutlineDropdown button')?.addEventListener('click', () => window.scrollTo({ top:0, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  function markActive() {
    const current = new URL(location.href);
    layout.querySelectorAll('.VPSidebarItem.level-0').forEach(group => group.classList.remove('has-active'));
    layout.querySelectorAll('.VPSidebar a, .VPNavBarMenu > a').forEach(link => {
      const target = new URL(link.href);
      const topLink = !!link.closest('.VPNavBarMenu');
      const lessonView = !current.searchParams.get('view') || !['prompts','skills','writing'].includes(current.searchParams.get('view'));
      const sameView = target.pathname !== '/ai.html' || (target.search ? target.search === current.search : lessonView);
      const match = topLink ? (target.pathname.startsWith('/links/') ? current.pathname.startsWith('/links/') : target.pathname === current.pathname) : target.pathname === current.pathname && sameView && (!cabinet || target.hash === current.hash || (!target.hash && !current.hash));
      link.classList.toggle('active',match);
      const row = link.closest('.VPSidebarItem.level-1');
      row?.classList.toggle('is-active-link',match);
      if (match) { link.setAttribute('aria-current','page'); link.closest('.VPSidebarItem.level-0')?.classList.add('has-active'); } else link.removeAttribute('aria-current');
    });
    layout.querySelectorAll('.VPSidebar .level-0 > .item[role=button]').forEach(item => { item.removeAttribute('role'); item.removeAttribute('tabindex'); });
  }
  markActive();
  window.addEventListener('hashchange', markActive);
  window.addEventListener('popstate', markActive);
  layout.addEventListener('click', event => {
    if (cabinet && event.target.closest('a[href="#teacher-task-panel"]')) {
      const panel = document.getElementById('teacher-task-panel');
      if (panel) panel.open = true;
    }
  });
  sidebar?.addEventListener('click', event => { if (event.target.closest('a')) closeMenus(); });
  // Keep images self-contained and use a real neutral resource icon for unavailable favicons.
  document.addEventListener('error', event => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.closest('.link-card, .dict-menu') && !image.src.endsWith('/brand/resource-icon.svg')) image.src = '/brand/resource-icon.svg';
  },true);
  const prose = document.querySelector('.vp-doc');
  if (prose && !cabinet && !document.querySelector('.english-doc-footer') && !document.querySelector('.VPDocFooter')) {
    const footer = document.createElement('footer'); footer.className = 'english-doc-footer';
    footer.innerHTML = '<span>English.tools</span><a href="/about.html">О проекте</a><a href="/guide.html">Как пользоваться</a><a href="/faq.html">Частые вопросы</a><a href="/telegram.html">Больше в Telegram</a>';
    prose.parentElement.append(footer);
  }
  // Local site search, with focused dialog, Escape and return-focus handled by the browser.
  const searchButton = layout.querySelector('.DocSearch-Button');
  let searchDialog, searchRecords = null, searchRequest = null;
  const normalizeSearch = value => String(value || '').toLocaleLowerCase('ru').replace(/ё/g,'е').normalize('NFKC').trim();
  async function getSearchRecords() {
    if (searchRecords) return searchRecords;
    if (!searchRequest) searchRequest = (async () => {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(),8000);
      try {
        const response = await fetch('/englinks-search.json', {signal:controller.signal});
        if (!response.ok) throw new Error('Search data unavailable');
        searchRecords = await response.json(); return searchRecords;
      } finally { clearTimeout(timeout); searchRequest = null; }
    })();
    return searchRequest;
  }
  async function showSearch() {
    if (!searchButton) return;
    if (!searchDialog) {
      searchDialog = document.createElement('dialog'); searchDialog.className = 'english-search'; searchDialog.setAttribute('aria-labelledby','english-search-label');
      searchDialog.innerHTML = '<div class="english-search-head"><label id="english-search-label" for="english-search-input">Поиск по инструментам</label><input id="english-search-input" type="search" placeholder="Название, тема или формат" autocomplete="off"><button class="english-search-close" type="button" aria-label="Закрыть поиск">Esc</button></div><div class="english-search-results" role="status"><p>Введите название или задачу.</p></div>';
      body.append(searchDialog);
      searchDialog.querySelector('button').addEventListener('click', () => searchDialog.close());
      searchDialog.addEventListener('click', event => { if (event.target === searchDialog) { const rect = searchDialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) searchDialog.close(); } });
      const input = searchDialog.querySelector('input'), results = searchDialog.querySelector('.english-search-results');
      input.addEventListener('input', async () => {
        const query = normalizeSearch(input.value).slice(0,200); results.replaceChildren();
        if (!query) { const p = document.createElement('p'); p.textContent = 'Введите название, задачу или формат.'; results.append(p); return; }
        const loading = document.createElement('p'); loading.textContent = 'Ищем инструменты…'; results.append(loading);
        try {
          const records = await getSearchRecords(); if (normalizeSearch(input.value).slice(0,200) !== query) return;
          results.replaceChildren();
          const terms = query.split(/\s+/), allMatches = records.filter(record => terms.every(term => normalizeSearch(record.search).includes(term))), matches = allMatches.slice(0,30);
          if (!matches.length) { const p = document.createElement('p'); p.textContent = 'Ничего не найдено. Попробуйте другое слово.'; results.append(p); }
          else { const p = document.createElement('p'); p.textContent = 'Найдено: '+allMatches.length+(allMatches.length > 30 ? '. Первые 30 результатов:' : ''); results.append(p); }
          matches.forEach(record => {
            const a = document.createElement('a'); a.href = record.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            const strong = document.createElement('strong'); strong.textContent = record.name;
            const small = document.createElement('small'); small.textContent = record.description;
            a.append(strong,small); results.append(a);
          });
          if (allMatches.length > 30) { const all = document.createElement('a'); all.href = '/links/all-tools.html?q='+encodeURIComponent(query); all.textContent = 'Все результаты в каталоге →'; results.append(all); }
        } catch {
          if (normalizeSearch(input.value).slice(0,200) !== query) return;
          results.replaceChildren(); const p = document.createElement('p'); p.textContent = 'Поиск не загрузился.'; const a = document.createElement('a'); a.href = '/links/all-tools.html?q='+encodeURIComponent(query); a.textContent = 'Открыть каталог и повторить поиск →'; results.append(p,a);
        }
      });
    }
    closeMenus(); if (!searchDialog.open) searchDialog.showModal(); searchDialog.querySelector('input').focus();
  }
  searchButton?.addEventListener('click', showSearch);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && searchButton) { event.preventDefault(); showSearch(); }
  });
})();
