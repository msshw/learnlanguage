import { checkSentence } from '../lib/ai.js';
import { requireSetup } from '../lib/auth.js';
import { listPracticeCards, listPracticeLogsSince, recordSentence } from '../lib/db.js';
import { formatInterval, formatNextDue } from '../lib/format.js';
import { defaultRating, highlightSegments, MAX_SENTENCE_LENGTH } from '../lib/practice.js';
import { practiceQueue, practiceStatus } from '../lib/practice-queue.js';
import { fsrsFields, previewIntervals, schedule } from '../lib/scheduler.js';
import { dayStart } from '../lib/time.js';

const profile = await requireSetup();
const tz = profile.timezone;

const $ = (selector) => document.querySelector(selector);
const views = { error: $('#view-error'), empty: $('#view-empty'), card: $('#view-card'), summary: $('#view-summary') };
const sentenceForm = $('#sentence-form');
const sentenceInput = $('#sentence');
const checkingBox = $('#checking');
const feedback = $('#feedback');
const ratingButtons = [...document.querySelectorAll('#ratings [data-rating]')];

const show = (name) => {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
  $('#focus-top').hidden = name !== 'card';
  $('#focus-foot').hidden = name !== 'card';
};

const nextDueText = (next) => (next ? `Next practice is due ${formatNextDue(next, tz)}` : 'Nothing else is scheduled');

function articleAndTerm(word) {
  const article = word.part_of_speech === 'noun' ? word.forms?.article : null;
  if (!article) return [word.term];
  const span = document.createElement('span');
  span.className = `v-art-text--${article}`;
  span.textContent = article;
  return [span, ' ', word.term];
}

// Session state. The queue is built once; the card objects are the ones in `allCards`, so a
// rated card's new state is visible to the summary.
let allCards = [];
let serverLogs = [];
let queue = [];
let answers = [];
let total = 0;
let phase = 'idle'; // 'prompt' | 'checking' | 'feedback' | 'saving' | 'save-failed' | 'idle'
let current;
let sentence;
let check; // { status: 'ok', ... } or { status: 'unavailable' }
let rating;
let payload;
let shownAt;
let submittedAt;
let checkId = 0; // a late response from a skipped or older check is ignored
let inflight = null; // the save in progress, so ending the session can wait for it

async function start() {
  show(null);
  let now;
  try {
    now = new Date();
    [allCards, serverLogs] = await Promise.all([
      listPracticeCards(profile.active_pair_id),
      listPracticeLogsSince(dayStart(now, tz)),
    ]);
  } catch {
    show('error');
    return;
  }
  const options = { cards: allCards, logsToday: serverLogs, now, tz };
  answers = [];
  queue = practiceQueue(options);
  if (queue.length === 0) {
    $('#empty-next').textContent = nextDueText(practiceStatus(options).nextAvailable);
    show('empty');
    $('#empty-home').focus();
    return;
  }
  total = queue.length;
  showCard();
}

function setHints() {
  $('#hint-submit').hidden = phase !== 'prompt';
  $('#hint-rate').hidden = phase !== 'feedback';
  $('#hint-next').hidden = phase !== 'feedback';
}

function showCard() {
  current = queue.shift();
  const word = current.word;
  phase = 'prompt';

  $('#progress').textContent = `${answers.length + 1} of ${total}`;
  $('#progress-bar').style.width = `${(answers.length / total) * 100}%`;
  $('#word').replaceChildren(...articleAndTerm(word));
  $('#translations').textContent = word.translations.join(', ');
  $('#hint').textContent = word.hint_en ?? '';
  $('#hint').hidden = !word.hint_en;
  $('#meta').textContent = word.part_of_speech;

  sentenceInput.value = '';
  $('#sentence-error').hidden = true;
  sentenceForm.hidden = false;
  checkingBox.hidden = true;
  feedback.hidden = true;
  setHints();
  show('card');
  sentenceInput.focus();
  shownAt = performance.now();
}

sentenceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (phase !== 'prompt') return;
  const text = sentenceInput.value.trim();
  const error = !text
    ? 'Write a sentence first'
    : text.length > MAX_SENTENCE_LENGTH
      ? `Use at most ${MAX_SENTENCE_LENGTH} characters`
      : '';
  $('#sentence-error').textContent = error;
  $('#sentence-error').hidden = !error;
  if (error) return;

  sentence = text;
  submittedAt = new Date();
  phase = 'checking';
  const id = ++checkId;
  sentenceForm.hidden = true;
  checkingBox.hidden = false;
  setHints();
  $('#skip').focus();

  const result = await checkSentence(current.word_id, sentence);
  if (phase === 'checking' && id === checkId) showFeedback(result);
});

$('#skip').addEventListener('click', () => {
  if (phase !== 'checking') return;
  checkId += 1; // ignore the pending response
  showFeedback({ status: 'unavailable' });
});

function selectRating(n) {
  rating = n;
  for (const button of ratingButtons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.rating) === n));
  }
}

function showFeedback(result) {
  phase = 'feedback';
  check = result;
  checkingBox.hidden = true;
  const ok = result.status === 'ok';

  // The sentence with issue spans as <mark> elements around text; nothing here parses markup.
  $('#your-sentence').replaceChildren(
    ...highlightSegments(sentence, ok ? result.issues : []).map(({ text, issue }) => {
      if (!issue) return document.createTextNode(text);
      const mark = document.createElement('mark');
      mark.textContent = text;
      mark.title = issue.message;
      return mark;
    }),
  );

  const verdict = $('#verdict');
  verdict.hidden = true;
  if (!ok) {
    verdict.className = 'v-feedback v-feedback--hard';
    $('#verdict-title').textContent = 'Check unavailable';
    $('#verdict-body').replaceChildren();
    verdict.hidden = false;
  } else if (!result.usesWord) {
    verdict.className = 'v-feedback v-feedback--again';
    $('#verdict-title').textContent = 'This sentence does not use the word';
    $('#verdict-body').replaceChildren();
    verdict.hidden = false;
  }

  const issues = ok ? result.issues : [];
  $('#issues').hidden = issues.length === 0;
  $('#issues').replaceChildren(
    ...issues.map((issue) => {
      const quote = document.createElement('span');
      quote.className = 'font-medium';
      quote.textContent = sentence.slice(issue.start, issue.end);
      const li = document.createElement('li');
      li.append(quote, `: ${issue.message}`);
      return li;
    }),
  );

  const showCorrected = ok && result.corrected !== sentence;
  $('#corrected-block').hidden = !showCorrected;
  $('#corrected').textContent = showCorrected ? result.corrected : '';

  const word = current.word;
  $('#example-block').hidden = ok || !word.example_de;
  $('#example-de').textContent = word.example_de ?? '';
  $('#example-en').textContent = word.example_en ?? '';
  $('#example-en').hidden = !word.example_en;

  const dues = previewIntervals(fsrsFields(current), submittedAt);
  for (const button of ratingButtons) {
    button.querySelector('small').textContent = formatInterval(dues[Number(button.dataset.rating) - 1], submittedAt);
  }
  selectRating(defaultRating(result)); // null after an unavailable check: the user has to choose
  $('#save-error').hidden = true;
  $('#continue').disabled = false;
  setHints();
  feedback.hidden = false;
  feedback.focus();
}

// Sends the kept payload. A failure shows the error with Retry; the same payload is sent again.
async function send() {
  phase = 'saving';
  $('#save-error').hidden = true;
  $('#continue').disabled = true;
  const request = recordSentence(payload);
  inflight = request.catch(() => {});
  try {
    await request;
  } catch {
    phase = 'save-failed';
    $('#save-error').hidden = false;
    $('#save-retry').focus();
    return;
  } finally {
    inflight = null;
  }

  Object.assign(current, payload.next);
  answers.push({ cardId: current.id, rating: payload.rating, stateBefore: payload.state_before, practicedAt: payload.practiced_at });
  if (queue.length > 0) showCard();
  else showSummary();
}

function confirmAttempt() {
  if (phase !== 'feedback' || !rating) return;
  const before = fsrsFields(current);
  const ok = check.status === 'ok';
  payload = {
    sentence_card_id: current.id,
    practiced_at: submittedAt.toISOString(),
    sentence,
    corrected: ok ? check.corrected : null,
    issues: ok ? check.issues : null,
    check_status: ok ? 'ok' : 'unavailable',
    rating,
    state_before: before,
    duration_ms: Math.round(performance.now() - shownAt),
    next: schedule(before, rating, submittedAt),
  };
  send();
}

function showSummary() {
  phase = 'idle';
  const logs = answers.map((a) => ({
    sentence_card_id: a.cardId,
    practiced_at: a.practicedAt,
    state_before: a.stateBefore,
  }));
  const status = practiceStatus({ cards: allCards, logsToday: [...serverLogs, ...logs], now: new Date(), tz });
  $('#sum-next').textContent = nextDueText(status.nextAvailable);
  $('#sum-attempts').textContent = String(answers.length);
  $('#sum-watch').textContent = String(answers.filter((a) => a.rating <= 2).length);
  show('summary');
  $('#summary-home').focus();
}

// An attempt being saved finishes before leaving.
async function endSession() {
  phase = 'idle';
  checkId += 1;
  await inflight;
  location.assign('/');
}

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    endSession();
    return;
  }
  if (phase === 'save-failed' && event.key === 'Enter' && document.activeElement?.id !== 'save-retry') {
    event.preventDefault();
    send();
    return;
  }
  if (phase !== 'feedback') return;
  if (/^[1-4]$/.test(event.key)) {
    event.preventDefault();
    selectRating(Number(event.key));
  } else if (event.key === 'Enter') {
    event.preventDefault();
    confirmAttempt();
  }
});

for (const button of ratingButtons) {
  button.addEventListener('click', () => {
    if (phase === 'feedback') selectRating(Number(button.dataset.rating));
  });
}
$('#continue').addEventListener('click', confirmAttempt);
$('#save-retry').addEventListener('click', () => {
  if (phase === 'save-failed') send();
});
$('#end').addEventListener('click', endSession);
$('#retry').addEventListener('click', start);

await start();
