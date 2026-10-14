const ADD_PATH = '/add.html';

const isTyping = (target) => Boolean(target?.closest?.('input, textarea, select, [contenteditable], dialog'));

const samePath = (href, pathname) => (href === '/' ? pathname === '/' || pathname === '/index.html' : href === pathname);

// Returns the href to open, or null. Alt+letter matches the physical key (event.code), because
// Option+S on a Mac types "ß" as event.key. Alt shortcuts work inside fields. N opens Add word,
// but not while typing, inside a dialog, or with a modifier held.
export const shortcutTarget = (event, pathname, links) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey) return null;
  let href = null;
  if (event.altKey) href = links.find((l) => !l.hidden && l.code === event.code)?.href ?? null;
  else if (event.code === 'KeyN' && !isTyping(event.target)) href = ADD_PATH;
  return href && !samePath(href, pathname) ? href : null;
};

export function installShortcut() {
  document.addEventListener('keydown', (event) => {
    // Read at press time: the Admin link is revealed after load, and only for admins.
    const links = [...document.querySelectorAll('.v-sidebar [data-code]')].map((a) => ({
      code: a.dataset.code,
      href: a.getAttribute('href'),
      hidden: a.hidden,
    }));
    const href = shortcutTarget(event, location.pathname, links);
    if (!href) return;
    event.preventDefault();
    location.assign(href);
  });
}
