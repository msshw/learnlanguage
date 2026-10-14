import { requireSetup } from '../lib/auth.js';
import { confirmSuggestion, suggest } from '../lib/ai.js';
import { REPORT_MIN, findDuplicates, insertWord, reportSuggestion } from '../lib/db.js';
import { buildWord, confirmTarget, normalizeTerm, senseToFormValues } from '../lib/word-form.js';
import { fillSenseMeta, initWordForm } from '../lib/word-form-view.js';

const profile = await requireSetup();
const pairId = profile.active_pair_id;

const $ = (selector) => document.querySelector(selector);
const termForm = $('#term-form');
const termInput = $('#term-input');
// The body is hidden until requireSetup() resolves, so autofocus alone is lost.
termInput.focus();
const termError = $('#term-error');
const duplicate = $('#duplicate');
const openWord = $('#open-word');
const suggesting = $('#suggesting');
const senses = $('#senses');
const senseList = $('#sense-list');
const notAWord = $('#not-a-word');
const reportButton = $('#report');
const reportForm = $('#report-form');
const reportReason = $('#report-reason');
const reportCount = $('#report-count');
const reportSend = $('#report-send');
const reportDone = $('#report-done');
const reportError = $('#report-error');
const notice = $('#notice');
const wordForm = $('#word-form');
const saved = $('#saved');
const view = initWordForm(wordForm);

const panels = [termForm, duplicate, suggesting, senses, notAWord, notice, wordForm];
const show = (...visible) => {
  for (const panel of panels) panel.hidden = !visible.includes(panel);
};

// 'ai_confirmed' once the form was filled from a picked sense; every other path is manual.
let source = 'manual';
// Bumped on every step change, so a late suggestion response is ignored.
let requestId = 0;
// A suggestion result held back while the duplicate warning for its corrected term is shown.
let held = null;
let currentSenses = [];
// The suggestion the current senses came from, and the sense picked from it (null for manual entry).
let currentSuggestion = { id: null };
let picked = null;

function showTermStep() {
  requestId += 1;
  source = 'manual';
  picked = null;
  held = null;
  show(termForm);
  termInput.focus();
}

// A picked sense keeps the sense list on screen, checked, above the filled form.
function showForm(term, { sense = null, message = '' } = {}) {
  requestId += 1;
  view.reset();
  if (sense) {
    view.fill(senseToFormValues(sense));
    source = 'ai_confirmed';
    picked = { index: currentSenses.indexOf(sense), sense };
  } else {
    wordForm.elements.term.value = term;
    source = 'manual';
    picked = null;
  }
  const radios = [...senseList.children];
  radios.forEach((radio, i) => radio.setAttribute('aria-checked', String(currentSenses[i] === sense)));
  notice.textContent = message;
  show(...(sense ? [senses] : []), ...(message ? [notice] : []), wordForm);
  wordForm.elements.translations.focus();
}

// The report button belongs to the current suggestion. It shows only when there is an id, and
// starts fresh on every new sense list.
function resetReport() {
  reportButton.hidden = !currentSuggestion.id;
  reportForm.hidden = true;
  reportReason.value = '';
  syncReportCount();
  reportDone.hidden = true;
  reportError.hidden = true;
}

function syncReportCount() {
  const length = reportReason.value.trim().length;
  reportCount.textContent = `${length} of ${REPORT_MIN} characters`;
  reportSend.disabled = length < REPORT_MIN;
}

reportReason.addEventListener('input', syncReportCount);

reportButton.addEventListener('click', () => {
  reportButton.hidden = true;
  reportForm.hidden = false;
  reportReason.focus();
});

reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = currentSuggestion.id;
  if (!id || reportSend.disabled) return;
  reportError.hidden = true;
  reportSend.disabled = true;
  try {
    await reportSuggestion(id, reportReason.value);
    if (id !== currentSuggestion.id) return;
    reportForm.hidden = true;
    reportDone.hidden = false;
  } catch {
    if (id !== currentSuggestion.id) return;
    reportError.hidden = false;
    syncReportCount();
  }
});

function showSenses(list, suggestion) {
  currentSenses = list;
  currentSuggestion = suggestion;
  senseList.replaceChildren(
    ...list.map((sense, i) => {
      const radio = $('#sense-template').content.firstElementChild.cloneNode(true);
      radio.setAttribute('aria-keyshortcuts', String(i + 1));
      radio.querySelector('.v-sense__num').textContent = String(i + 1);
      radio.querySelector('.v-sense__trans').textContent = sense.translations.join(', ');
      const meta = radio.querySelector('.sense-meta');
      fillSenseMeta(meta, sense);
      radio.querySelector('.v-sense__ex').textContent = sense.example_de ?? '';
      radio.addEventListener('click', () => showForm(sense.term, { sense }));
      return radio;
    }),
  );
  resetReport();
  show(senses);
  senseList.firstElementChild.focus();
}

// Up and Down move between the meanings, as in any radio group.
senseList.addEventListener('keydown', (event) => {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  const radios = [...senseList.children];
  const at = radios.indexOf(event.target);
  if (!step || at === -1) return;
  event.preventDefault();
  radios[(at + step + radios.length) % radios.length].focus();
});

const sameIgnoringCase = (a, b) => normalizeTerm(a).toLowerCase() === normalizeTerm(b).toLowerCase();

async function showResult(term, result) {
  if (result.status === 'ok') {
    showSenses(result.senses.slice(0, 3), { id: result.suggestionId });
  } else if (result.status === 'not_a_word') {
    show(notAWord);
    $('#save-manually').focus();
  } else {
    showForm(term, { message: 'Suggestions unavailable' });
  }
}

async function requestSuggestions(term) {
  held = null;
  const id = ++requestId;
  show(suggesting);
  $('#skip-suggestions').focus();
  const result = await suggest(term);
  if (id !== requestId) return;

  const corrected = result.status === 'ok' ? result.senses[0].term : null;
  if (corrected && !sameIgnoringCase(corrected, term)) {
    try {
      const matches = await findDuplicates(pairId, corrected);
      if (id !== requestId) return;
      if (matches.length > 0) {
        held = { term, result };
        showDuplicate(matches[0].id, corrected);
        return;
      }
    } catch {
      // the duplicate check is advisory; carry on to the senses
    }
  }
  await showResult(term, result);
}

function showDuplicate(id, term) {
  openWord.href = `/words.html?edit=${encodeURIComponent(id)}`;
  duplicate.dataset.term = term;
  show(duplicate);
}

termForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saved.hidden = true;
  termError.hidden = true;
  held = null;

  const term = normalizeTerm(termInput.value);
  if (!term) {
    termError.textContent = 'Enter a word';
    termError.hidden = false;
    return;
  }

  try {
    const matches = await findDuplicates(pairId, term);
    if (matches.length > 0) showDuplicate(matches[0].id, term);
    else await requestSuggestions(term);
  } catch (err) {
    termError.textContent = `Could not check the word: ${err.message}`;
    termError.hidden = false;
  }
});

$('#add-anyway').addEventListener('click', () => {
  if (held) {
    const { term, result } = held;
    held = null;
    showResult(term, result);
  } else {
    requestSuggestions(duplicate.dataset.term);
  }
});

$('#skip-suggestions').addEventListener('click', () => showForm(normalizeTerm(termInput.value)));
$('#manual-instead').addEventListener('click', () => showForm(normalizeTerm(termInput.value)));
$('#save-manually').addEventListener('click', () => showForm(normalizeTerm(termInput.value)));
$('#not-a-word-back').addEventListener('click', showTermStep);
$('#cancel').addEventListener('click', showTermStep);

// 1 to 3 pick a meaning, also once the form is open, but not while typing in a field.
document.addEventListener('keydown', (event) => {
  if (senses.hidden || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest?.('input, textarea, select')) return;
  const sense = currentSenses[Number(event.key) - 1];
  if (sense) {
    event.preventDefault();
    showForm(sense.term, { sense });
  }
});

wordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = buildWord(view.read());
  if (!result.ok) {
    view.showErrors(result.errors);
    return;
  }

  const button = wordForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await insertWord(pairId, result.value, source);
    // Fire and forget: a failed confirm must not affect the save.
    const target = confirmTarget(picked, currentSuggestion.id, result.value);
    if (target) confirmSuggestion(target.id, target.index);
    termInput.value = '';
    saved.hidden = false;
    showTermStep();
  } catch (err) {
    view.showErrors({ form: `Could not save the word: ${err.message}` });
  } finally {
    button.disabled = false;
  }
});
