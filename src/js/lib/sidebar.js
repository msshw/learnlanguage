import { getSession } from './auth.js';
import { getProfile, listLogsSince, listPracticeCards, listPracticeLogsSince, listQueueCards } from './db.js';
import { userPending } from './pending.js';
import { practiceStatus } from './practice-queue.js';
import { homeStatus } from './queue.js';
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
    if (!profile.active_pair_id) return;
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
  const [cards, logsToday] = await Promise.all([
    listQueueCards(profile.active_pair_id),
    listLogsSince(dayStart(now, tz)),
  ]);
  const { dueCount } = homeStatus({
    cards,
    logsToday,
    pending: userPending(profile.id).payloads(),
    wordCount: cards.length,
    now,
    tz,
    limit: profile.new_words_per_day,
  });
  pill.textContent = String(dueCount);
  pill.hidden = dueCount === 0;
}

async function fillPracticeCount(pill, profile, now, tz) {
  if (!pill) return;
  const [cards, logsToday] = await Promise.all([
    listPracticeCards(profile.active_pair_id),
    listPracticeLogsSince(dayStart(now, tz)),
  ]);
  const { dueCount } = practiceStatus({ cards, logsToday, now, tz });
  pill.textContent = String(dueCount);
  pill.hidden = dueCount === 0;
}

// Collapses the sidebar to icons. The choice is kept per device; blocked storage just means it is not kept.
export function installSidebarToggle() {
  const nav = document.querySelector('.v-sidebar');
  const button = document.querySelector('#sidebar-toggle');
  if (!nav || !button) return;
  const apply = (collapsed) => {
    nav.classList.toggle('is-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  };
  let collapsed = false;
  try {
    collapsed = localStorage.getItem('sidebar-collapsed') === '1';
  } catch {
    // Storage blocked: start expanded.
  }
  apply(collapsed);
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
