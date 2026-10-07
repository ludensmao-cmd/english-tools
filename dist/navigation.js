'use strict';

(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const interruptEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  let frame = 0;
  let previousScrollBehavior = null;

  function stopScroll() {
    cancelAnimationFrame(frame);
    interruptEvents.forEach(name => window.removeEventListener(name, stopScroll));
    if (previousScrollBehavior !== null) {
      root.style.scrollBehavior = previousScrollBehavior;
      previousScrollBehavior = null;
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    if (link.classList.contains('skip-link')) return;
    link.addEventListener('click', event => {
      if (reducedMotion.matches || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;

      event.preventDefault();
      stopScroll();
      const start = window.scrollY;
      const offset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
      const end = Math.max(0, Math.min(root.scrollHeight - innerHeight, start + target.getBoundingClientRect().top - offset));
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      if (Math.abs(end - start) < 2) return;

      previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      interruptEvents.forEach(name => window.addEventListener(name, stopScroll, { passive: true }));
      const duration = Math.min(720, Math.max(480, Math.abs(end - start) * 0.55));
      let started;

      function step(now) {
        started ??= now;
        const progress = Math.min(1, (now - started) / duration);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        window.scrollTo(0, start + (end - start) * eased);
        if (progress < 1) frame = requestAnimationFrame(step);
        else stopScroll();
      }

      frame = requestAnimationFrame(step);
    });
  });

  window.addEventListener('pagehide', stopScroll);
})();
