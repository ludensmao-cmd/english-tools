'use strict';

// Set the real public channel URL here when the owner supplies it.
window.englishToolsConfig = { telegramUrl: '' };

(() => {
  const value = window.englishToolsConfig.telegramUrl;
  if (!value) return;
  let url;
  try { url = new URL(value); } catch { return; }
  if (url.protocol !== 'https:' || !['t.me', 'telegram.me'].includes(url.hostname)) return;
  document.querySelectorAll('[data-telegram-link]').forEach(link => {
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.hidden = false;
  });
  document.querySelectorAll('[data-channel-fallback]').forEach(item => { item.hidden = true; });
})();
