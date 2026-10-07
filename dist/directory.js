'use strict';

(() => {
  if (!document.body.classList.contains('directory-page')) return;
  const sidebar = document.getElementById('directory-sidebar');
  const toggle = document.querySelector('[data-directory-toggle]');
  if (!sidebar || !toggle) return;
  document.documentElement.classList.add('directory-enhanced');
  const compact = window.matchMedia('(max-width: 959px)');
  const setOpen = (open, restoreFocus = false) => {
    const expanded = compact.matches && open;
    document.body.dataset.directoryOpen = String(expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    if (restoreFocus && compact.matches) toggle.focus();
  };
  setOpen(false);
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  sidebar.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    setOpen(false);
    const href = link.getAttribute('href');
    if (href.startsWith('#')) {
      let target;
      try { target = document.getElementById(decodeURIComponent(href.slice(1))); } catch { return; }
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false, true);
    }
  });
  if (compact.addEventListener) compact.addEventListener('change', () => setOpen(false));
  else if (compact.addListener) compact.addListener(() => setOpen(false));

  // A page link keeps its page state; only the links to local sections follow the reading position.
  const groups = [sidebar, ...document.querySelectorAll('.article-toc nav')];
  groups.forEach(group => {
    const links = [...group.querySelectorAll('a[href^="#"]')];
    const items = links.map(link => {
      const hash = link.getAttribute('href').slice(1);
      let id;
      try { id = decodeURIComponent(hash); } catch { return null; }
      const target = document.getElementById(id);
      return target ? { link, target } : null;
    }).filter(Boolean);
    if (!items.length) return;
    const activate = active => {
      items.forEach(item => {
        if (item === active) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      });
    };
    items.forEach(item => item.link.addEventListener('click', () => activate(item)));
    if (!('IntersectionObserver' in window)) return;
    const visible = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      const current = items.filter(item => visible.has(item.target)).sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top)[0];
      if (current) activate(current);
    }, { rootMargin: '-130px 0px -55% 0px', threshold: 0 });
    items.forEach(item => observer.observe(item.target));
  });
})();
