import { requireSetup } from '../lib/auth.js';
import { listLogsSince, listQueueCards, recordReview } from '../lib/db.js';
import { formatInterval, formatNextDue } from '../lib/format.js';
import { languageLabel, posLabel, t } from '../lib/i18n.js';
import { profileOf } from '../lib/languages.js';
import { grade } from '../lib/grader.js';
import { userPending } from '../lib/pending.js';
import { buildQueue, nextAvailable } from '../lib/queue.js';
import { fsrsFields, previewIntervals, schedule } from '../lib/scheduler.js';
import { sessionSummary } from '../lib/session.js';
import { installShortcut } from '../lib/shortcut.js';
import { dayStart } from '../lib/time.js';
import { lang } from '../lib/ui-lang.js';

// Review has no sidebar, so the Add word shortcut is installed here.
installShortcut();

const profile = await requireSetup();
const tz = profile.timezone;
const { pair } = profile;
const limit = pair.new_words_per_day;
const targetName = languageLabel(lang, pair.target_lang);
const nativeName = languageLabel(lang, pair.native_lang);
const targetProfile = profileOf(pair.target_lang);
const pending = userPending(profile.id);

const $ = (selector) => document.querySelector(selector);
const views = {
  error: $('#view-error'),
  empty: $('#view-empty'),
  card: $('#view-card'),
  summary: $('#view-summary'),
};
const answerForm = $('#answer-form');
const answerInput = $('#answer');
const feedback = $('#feedback');
const ratingButtons = [...document.querySelectorAll('#ratings [data-rating]')];

// The top bar and key hints only belong to a card in progress.
const show = (name) => {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
  $('#focus-top').hidden = name !== 'card';
  $('#focus-foot').hidden = name !== 'card';
};
const updateBanner = () => {
  $('#banner').hidden = !pending.needsBanner();
};

const nextDueText = (next) =>
  next ? t(lang, 'review.nextDueAt', { when: formatNextDue(next, tz, lang) }) : t(lang, 'common.nothingScheduled');

// The article as its own span (coloured by class), then the term. Plain term when there is no article.
function articleAndTerm(word, classPrefix) {
  const article = word.part_of_speech === 'noun' ? word.forms?.article : null;
  if (!targetProfile.articles.includes(article)) return [word.term];
  const span = document.createElement('span');
  span.className = classPrefix + article;
  span.textContent = article;
  return [span, ' ', word.term];
}

const paragraph = (...nodes) => {
  const p = document.createElement('p');
  p.append(...nodes);
  return p;
};

// Session state. `queue` holds the cards still to show; the card objects are the same ones
// as in `allCards`, so a scheduled card's new state is visible to the summary.
let allCards = [];
let serverLogs = [];
let queue = [];
let answers = [];
let total = 0;
let phase = 'idle'; // 'prompt' | 'feedback' | 'idle'
let current;
let graded;
let rating;
let typed;
let submittedAt;
let durationMs;
let shownAt;
const saving = new Set(); // answers still being sent, so ending the session can wait for them

async function start() {
  show(null);
  let now;
  try {
    await pending.flush(recordReview);
    now = new Date();
    [allCards, serverLogs] = await Promise.all([
      listQueueCards(pair.id),
      listLogsSince(dayStart(now, tz), pair.id),
    ]);
  } catch {
    show('error');
    return;
  }
  updateBanner();

  const options = { cards: allCards, logsToday: serverLogs, pending: pending.payloads(), now, tz, limit };
  answers = [];
  queue = buildQueue(options);
  if (queue.length === 0) {
    const next = nextAvailable(options);
    $('#empty-next').textContent = next ? nextDueText(next) : '';
    show('empty');
    $('#empty-home').focus();
    return;
  }
  total = queue.length;
  showCard();
}

function setHints() {
  $('#hint-check').hidden = phase !== 'prompt';
  $('#hint-rate').hidden = phase !== 'feedback';
  $('#hint-next').hidden = phase !== 'feedback';
}

function showCard() {
  current = queue.shift();
  const word = current.word;
  phase = 'prompt';

  $('#progress').textContent = t(lang, 'review.progress', { n: answers.length + 1, total });
  $('#progress-bar').style.width = `${(answers.length / total) * 100}%`;
  if (current.direction === 'forward') {
    $('#direction').textContent = `${targetName} → ${nativeName}`;
    $('#prompt').replaceChildren(...articleAndTerm(word, 'v-art-text--'));
  } else {
    $('#direction').textContent = [`${nativeName} → ${targetName}`, word.hint_native].filter(Boolean).join(' · ');
    $('#prompt').textContent = word.translations.join(', ');
  }
  $('#meta').textContent = posLabel(lang, word.part_of_speech);

  answerInput.value = '';
  answerForm.hidden = false;
  feedback.hidden = true;
  setHints();
  show('card');
  answerInput.focus();
  shownAt = performance.now();
}

const VERDICT = {
  correct: ['good', 'review.verdict.correct'],
  typo: ['good', 'review.verdict.typo'],
  article_wrong: ['hard', 'review.verdict.articleWrong'],
  wrong: ['again', 'review.verdict.wrong'],
};

// The full answer, then plural, verb forms and example sentence.
function answerLines(word, direction) {
  const f = word.forms ?? {};
  const lines = [
    direction === 'forward' ? paragraph(word.translations.join(', ')) : paragraph(...articleAndTerm(word, 'v-art-text--')),
  ];
  if (f.plural) lines.push(paragraph(t(lang, 'review.plural', { value: f.plural })));
  if (f.praeteritum) lines.push(paragraph(t(lang, 'review.praeteritum', { value: f.praeteritum })));
  if (f.partizip2) lines.push(paragraph(t(lang, 'review.partizip2', { value: f.partizip2 })));
  if (f.auxiliary) lines.push(paragraph(t(lang, 'review.auxiliary', { value: f.auxiliary })));
  if (f.separable_prefix) lines.push(paragraph(t(lang, 'review.separablePrefix', { value: f.separable_prefix })));
  if (word.example_target) lines.push(paragraph(word.example_target));
  if (word.example_native) lines.push(paragraph(word.example_native));
  return lines;
}

function selectRating(n) {
  rating = n;
  for (const button of ratingButtons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.rating) === n));
  }
}

function showFeedback() {
  phase = 'feedback';
  answerForm.hidden = true;

  // A wrong answer is struck through; a typo is shown as typed; a correct one needs no echo.
  const typedEl = $('#typed');
  const struck = graded.result === 'wrong' || graded.result === 'article_wrong';
  typedEl.hidden = graded.result === 'correct';
  if (!typed.trim()) typedEl.textContent = t(lang, 'review.typedNothing');
  else if (struck) {
    const s = document.createElement('s');
    s.textContent = typed;
    typedEl.replaceChildren(s);
  } else typedEl.textContent = typed;

  const [variant, titleKey] = VERDICT[graded.result];
  $('#verdict').className = `v-feedback v-feedback--${variant}`;
  $('#result').textContent = t(lang, titleKey);
  $('#extras').replaceChildren(...answerLines(current.word, current.direction));

  // Same card state and moment that confirmAnswer schedules with.
  const dues = previewIntervals(fsrsFields(current), submittedAt);
  for (const button of ratingButtons) {
    button.querySelector('small').textContent = formatInterval(dues[Number(button.dataset.rating) - 1], submittedAt, lang);
  }
  selectRating(graded.rating);
  setHints();
  feedback.hidden = false;
  feedback.focus();
}

answerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (phase !== 'prompt') return;
  typed = answerInput.value;
  submittedAt = new Date();
  durationMs = Math.round(performance.now() - shownAt);
  graded = grade(typed, current.word, current.direction, pair);
  rating = graded.rating;
  showFeedback();
});

function confirmAnswer() {
  if (phase !== 'feedback') return;
  phase = 'idle';

  const before = fsrsFields(current);
  const next = schedule(before, rating, submittedAt);
  const payload = {
    card_id: current.id,
    reviewed_at: submittedAt.toISOString(),
    typed_answer: typed,
    grader_result: graded.result,
    rating,
    overridden: rating !== graded.rating,
    state_before: before,
    duration_ms: durationMs,
    next,
  };

  Object.assign(current, next); // an Again card returns with its new state
  answers.push({
    cardId: current.id,
    word: current.word,
    direction: current.direction,
    rating,
    result: graded.result,
    stateBefore: before,
    reviewedAt: payload.reviewed_at,
  });
  // Not awaited: the next card shows at once; a failed save goes to the pending list.
  const save = pending.record(payload, recordReview).then(updateBanner, updateBanner);
  saving.add(save);
  save.finally(() => saving.delete(save));

  if (rating === 1) {
    queue.push(current);
    total += 1;
  }
  if (queue.length > 0) showCard();
  else showSummary();
}

function showSummary() {
  phase = 'idle';
  const now = new Date();
  const answered = answers.map((a) => ({
    card_id: a.cardId,
    reviewed_at: a.reviewedAt,
    state_before: a.stateBefore,
    cards: { direction: a.direction },
  }));
  const next = nextAvailable({
    cards: allCards,
    logsToday: [...serverLogs, ...answered],
    pending: [],
    now,
    tz,
    limit,
  });
  $('#sum-next').textContent = nextDueText(next);

  const summary = sessionSummary(answers, lang);
  $('#sum-reviewed').textContent = String(summary.reviewed);
  $('#sum-remembered').textContent = String(summary.remembered);
  $('#sum-watch').textContent = String(summary.toWatch.length);

  $('#watch').hidden = summary.toWatch.length === 0;
  $('#watch-list').replaceChildren(
    ...summary.toWatch.map(({ word, reason }) => {
      const label = document.createElement('span');
      label.className = 'v-word';
      label.append(...articleAndTerm(word, 'v-art v-art--'));
      const why = document.createElement('span');
      why.className = 'v-hint';
      why.textContent = reason;
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-4';
      li.append(label, why);
      return li;
    }),
  );

  show('summary');
  $('#summary-home').focus();
}

// Answers already confirmed are saved (or kept in the pending list) before leaving.
async function endSession() {
  phase = 'idle';
  await Promise.allSettled(saving);
  location.assign('/');
}

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    endSession();
    return;
  }
  if (phase !== 'feedback') return;
  if (/^[1-4]$/.test(event.key)) {
    event.preventDefault();
    selectRating(Number(event.key));
  } else if (event.key === 'Enter') {
    event.preventDefault();
    confirmAnswer();
  }
});

for (const button of ratingButtons) {
  button.addEventListener('click', () => {
    if (phase === 'feedback') selectRating(Number(button.dataset.rating));
  });
}
$('#continue').addEventListener('click', confirmAnswer);
$('#end').addEventListener('click', endSession);
$('#retry').addEventListener('click', start);

setInterval(() => pending.flush(recordReview).then(updateBanner, updateBanner), 15000);
await start();
