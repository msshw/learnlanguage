import { requireSetup } from '../lib/auth.js';
import { countWords, listLogsSince, listQueueCards, recordReview } from '../lib/db.js';
import { formatDay, formatNextDue, greeting } from '../lib/format.js';
import { userPending } from '../lib/pending.js';
import { languageLabel, plural, t } from '../lib/i18n.js';
import { homeStatus } from '../lib/queue.js';
import { dayStart } from '../lib/time.js';
import { lang } from '../lib/ui-lang.js';

const profile = await requireSetup();
const tz = profile.timezone;
const pending = userPending(profile.id);

const $ = (selector) => document.querySelector(selector);
const card = $('#home-card');
const stats = $('#home-stats');
const error = $('#home-error');
const startReview = $('#start-review');
const addWord = $('#add-word');
const states = {
  empty: $('#home-empty'),
  due: $('#home-due'),
  nothing: $('#home-nothing'),
  done: $('#home-done'),
};

$('#empty-hint').textContent = t(lang, 'common.emptyHint', { language: languageLabel(lang, profile.pair.target_lang) });

// The profile has no name column yet, so this greets without a name until one exists.
$('#greeting').textContent = greeting(new Date(), tz, profile.name, lang);

startReview.addEventListener('click', () => location.assign('/review.html'));

// Enter starts the review from anywhere on the page that is not a control.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || startReview.hidden || event.target !== document.body) return;
  event.preventDefault();
  startReview.click();
});

async function load() {
  card.hidden = true;
  stats.hidden = true;
  error.hidden = true;
  try {
    await pending.flush(recordReview);
    const now = new Date();
    const [wordCount, cards, logsToday] = await Promise.all([
      countWords(profile.pair.id),
      listQueueCards(profile.pair.id),
      listLogsSince(dayStart(now, tz), profile.pair.id),
    ]);
    const limit = profile.pair.new_words_per_day;
    const status = homeStatus({ cards, logsToday, pending: pending.payloads(), wordCount, now, tz, limit });

    $('#banner').hidden = !pending.needsBanner();
    $('#today').textContent = formatDay(now, tz, lang);
    $('#due-count').textContent = String(status.dueCount);
    $('#due-label').textContent = plural(lang, 'home.dueLabel', status.dueCount);
    const nextText = status.nextAvailable ? t(lang, 'format.nextDue', { when: formatNextDue(status.nextAvailable, tz, lang) }) : '';
    $('#nothing-next').textContent = nextText;
    $('#done-next').textContent = nextText;
    $('#word-count').textContent = String(wordCount);
    $('#new-today').textContent = t(lang, 'home.newTodayValue', { n: status.newToday, limit });

    for (const [kind, el] of Object.entries(states)) el.hidden = kind !== status.kind;
    const due = status.kind === 'due';
    startReview.hidden = !due;
    addWord.classList.toggle('v-btn--primary', !due);
    addWord.classList.toggle('v-btn--ghost', due);
    card.hidden = false;
    stats.hidden = false;
    if (due) startReview.focus();
  } catch {
    error.hidden = false;
  }
}

$('#retry').addEventListener('click', load);
await load();
