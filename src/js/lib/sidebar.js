import { getSession } from './auth.js';
import { cacheLanguage } from './i18n-dom.js';
import { t, uiLanguage } from './i18n.js';
import { lang, onLanguage, setLang } from './ui-lang.js';
import { getProfile, listLogsSince, listPairs, listPracticeCards, listPracticeLogsSince, listQueueCards, setActivePair } from './db.js';
import { userPending } from './pending.js';
import { practiceStatus } from './practice-queue.js';
import { homeStatus } from './queue.js';
import { moveIndex, otherPairs, pairLabel } from './switcher.js';
import { dayStart } from './time.js';

// Fills the sidebar from the profile: the Admin link for admins (a hint only; the admin function
// checks the flag again), the due count on the Review link (the same number Home shows) and the
// count of the practice queue on the Practice link.
// ponytail: runs Home's card query a second time on Home; pass Home's count in if that ever feels slow.
export async function fillSidebar() {
  const pill = document.querySelector('#nav-due');
  if (!(await getSession())) return;
  try {
    const profile = await getProfile();
    if (profile.is_admin === true) {
      const link = document.querySelector('.v-sidebar [data-admin-only]');
      if (link) link.hidden = false;
    }
    if (!profile.pair) return;
    const own = uiLanguage(profile.pair.native_lang);
    if (own !== lang) setLang(own);
    fillSwitcher(profile);
    const now = new Date();
    const tz = profile.timezone;
    // Independent: a failure of one count must not hide the other.
    await Promise.allSettled([
      fillReviewCount(pill, profile, now, tz),
      fillPracticeCount(document.querySelector('#nav-practice'), profile, now, tz),
    ]);
  } catch {
    // The pill is a hint; the page shows its own load errors.
  }
}

async function fillReviewCount(pill, profile, now, tz) {
  if (!pill) return;
  const dueCount = await reviewDue(profile.pair, profile, now, tz);
  pill.textContent = String(dueCount);
  pill.hidden = dueCount === 0;
}

// The number Home shows for a pair.
async function reviewDue(pair, profile, now, tz) {
  const [cards, logsToday] = await Promise.all([
    listQueueCards(pair.id),
    listLogsSince(dayStart(now, tz), pair.id),
  ]);
  return homeStatus({
    cards,
    logsToday,
    pending: userPending(profile.id).payloads(),
    wordCount: cards.length,
    now,
    tz,
    limit: pair.new_words_per_day,
  }).dueCount;
}

async function fillPracticeCount(pill, profile, now, tz) {
  if (!pill) return;
  const [cards, logsToday] = await Promise.all([
    listPracticeCards(profile.pair.id),
    listPracticeLogsSince(dayStart(now, tz), profile.pair.id),
  ]);
  const { dueCount } = practiceStatus({ cards, logsToday, now, tz });
  pill.textContent = String(dueCount);
  pill.hidden = dueCount === 0;
}

// Pair switcher: shows the active pair; the menu of other pairs and their due counts loads on first open.
function fillSwitcher(profile) {
  const $ = (id) => document.querySelector(id);
  const root = $('#pair-switcher');
  const button = $('#pair-button');
  const menu = $('#pair-menu');
  if (!root || !button || !menu) return;
  const label = pairLabel(profile.pair, lang);
  button.querySelector('.pair-name').textContent = label.name;
  button.querySelector('.pair-from').textContent = label.from;
  button.querySelector('.pair-code').textContent = label.code;
  button.setAttribute('aria-label', label.accessible);
  button.title = label.accessible;
  root.hidden = false;

  const items = $('#pair-items');
  const empty = $('#pair-empty');
  const error = $('#pair-error');
  let loaded = false;
  const focusables = () => [...menu.querySelectorAll('[role="menuitem"]:not([hidden])')];
  const close = (refocus) => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  };

  async function load() {
    loaded = true;
    let pairs;
    try {
      pairs = otherPairs(await listPairs(), profile.pair.id);
    } catch (err) {
      loaded = false;
      error.textContent = t(lang, 'sidebar.loadLanguagesError', { message: err.message });
      error.hidden = false;
      return;
    }
    empty.hidden = pairs.length > 0;
    const now = new Date();
    for (const pair of pairs) {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.className = 'pair-item';
      const text = document.createElement('span');
      text.className = 'pair-text';
      const { name, from, accessible } = pairLabel(pair, lang);
      const nameEl = document.createElement('span');
      nameEl.className = 'pair-name';
      nameEl.textContent = name;
      const fromEl = document.createElement('span');
      fromEl.className = 'v-hint';
      fromEl.textContent = from;
      text.append(nameEl, fromEl);
      item.append(text);
      item.setAttribute('aria-label', accessible);
      item.addEventListener('click', () => choose(pair));
      items.append(item);
      // A count that fails to load is left out.
      reviewDue(pair, profile, now, profile.timezone)
        .then((n) => {
          if (n === 0) return;
          const pill = document.createElement('span');
          pill.className = 'v-count';
          pill.textContent = String(n);
          item.append(pill);
          item.setAttribute('aria-label', t(lang, 'sidebar.pairDue', { label: accessible, n }));
        })
        .catch(() => {});
    }
    focusables()[0]?.focus();
  }

  async function choose(switchTo) {
    const id = switchTo.id;
    error.hidden = true;
    try {
      await setActivePair(id);
      // The reload shows the new pair in its own language from the first paint.
      cacheLanguage(uiLanguage(switchTo.native_lang));
      location.reload();
    } catch (err) {
      error.textContent = t(lang, 'sidebar.switchError', { message: err.message });
      error.hidden = false;
    }
  }

  const open = () => {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    if (loaded) focusables()[0]?.focus();
    else load();
  };
  button.addEventListener('click', () => (menu.hidden ? open() : close(false)));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && menu.hidden) {
      event.preventDefault();
      open();
    }
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    const list = focusables();
    const next = moveIndex(list.indexOf(document.activeElement), event.key, list.length);
    if (next === null) return;
    event.preventDefault();
    list[next].focus();
  });
  document.addEventListener('click', (event) => {
    if (!menu.hidden && !root.contains(event.target)) close(false);
  });
}

// Collapses the sidebar to icons. The choice is kept per device; blocked storage just means it is not kept.
export function installSidebarToggle() {
  const nav = document.querySelector('.v-sidebar');
  const button = document.querySelector('#sidebar-toggle');
  if (!nav || !button) return;
  const apply = (collapsed) => {
    nav.classList.toggle('is-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', t(lang, collapsed ? 'sidebar.expand' : 'sidebar.collapse'));
  };
  let collapsed = false;
  try {
    collapsed = localStorage.getItem('sidebar-collapsed') === '1';
  } catch {
    // Storage blocked: start expanded.
  }
  apply(collapsed);
  onLanguage(() => apply(collapsed));
  button.addEventListener('click', () => {
    collapsed = !collapsed;
    apply(collapsed);
    try {
      localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
    } catch {
      // Not kept; the toggle still works on this page.
    }
  });
}
