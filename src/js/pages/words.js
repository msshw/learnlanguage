import { requireSetup } from '../lib/auth.js';
import { listWords, softDeleteWord, updateWord } from '../lib/db.js';
import { formatRelativeDay } from '../lib/format.js';
import { buildWord } from '../lib/word-form.js';
import { articleBadge, initWordForm } from '../lib/word-form-view.js';
import { applyTranslations } from '../lib/i18n-dom.js';
import { languageLabel, t } from '../lib/i18n.js';
import { profileOf } from '../lib/languages.js';
import { lang } from '../lib/ui-lang.js';
import { matchesQuery, nextDue, wordLabel } from '../lib/word-list.js';

const profile = await requireSetup();
const langProfile = profileOf(profile.pair.target_lang);
document.querySelector('#empty-hint').textContent = t(lang, 'common.emptyHint', { language: languageLabel(lang, profile.pair.target_lang) });

const loadError = document.querySelector('#load-error');
const empty = document.querySelector('#empty');
const list = document.querySelector('#list');
const search = document.querySelector('#search');
const noResults = document.querySelector('#no-results');
const table = document.querySelector('#table');
const rows = document.querySelector('#rows');
const rowTemplate = document.querySelector('#row-template');

const editDialog = document.querySelector('#edit-dialog');
const editForm = document.querySelector('#edit-form');
const editView = initWordForm(editForm, langProfile, {
  target: languageLabel(lang, profile.pair.target_lang),
  native: languageLabel(lang, profile.pair.native_lang),
}, lang);
const editActions = document.querySelector('#edit-actions');
const deleteStep = document.querySelector('#delete-step');
const deleteError = document.querySelector('#delete-error');
const wordTotal = document.querySelector('#word-total');

// ponytail: all words are loaded and filtered here; a few thousand is fine. If search gets slow,
// move it into the query with a view and a trigram index (SPEC §4).
let words = [];
let editing = null;

function render() {
  wordTotal.textContent = String(words.length);
  empty.hidden = words.length > 0;
  list.hidden = words.length === 0;
  if (words.length === 0) return;

  const shown = words.filter((w) => matchesQuery(w, search.value));
  noResults.hidden = shown.length > 0;
  table.hidden = shown.length === 0;

  const now = new Date();
  rows.replaceChildren(
    ...shown.map((word) => {
      const row = rowTemplate.content.cloneNode(true);
      applyTranslations(row, lang);
      const due = nextDue(word.cards);
      const label = row.querySelector('.v-word');
      label.href = `/word.html?id=${word.id}`;
      const badge = articleBadge(word, langProfile);
      // The space keeps "das Haus" readable as text, not "dasHaus".
      label.append(...(badge ? [badge, ' '] : []), word.term);
      if (word.hint_native) {
        const hint = document.createElement('p');
        hint.className = 'v-hint';
        hint.textContent = word.hint_native;
        row.querySelector('[data-cell="word"]').append(hint);
      }
      row.querySelector('[data-cell="translations"]').textContent = word.translations.join(', ');
      row.querySelector('[data-cell="due"]').textContent = due ? formatRelativeDay(due, now, profile.timezone, lang) : '';
      const edit = row.querySelector('[data-action="edit"]');
      edit.setAttribute('aria-label', t(lang, 'words.editWord', { word: wordLabel(word) }));
      edit.addEventListener('click', () => openEdit(word));
      return row;
    }),
  );
}

const showDeleteStep = (visible) => {
  deleteStep.hidden = !visible;
  editActions.hidden = visible;
  deleteError.hidden = true;
};

function openEdit(word) {
  editing = word;
  editView.fill(word);
  showDeleteStep(false);
  editDialog.showModal();
}

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = buildWord(editView.read(), langProfile, lang);
  if (!result.ok) {
    editView.showErrors(result.errors);
    return;
  }
  const button = editForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const updated = await updateWord(editing.id, result.value);
    Object.assign(editing, updated); // keeps the embedded cards
    editDialog.close();
    render();
  } catch (err) {
    editView.showErrors({ form: t(lang, 'common.saveWordError', { message: err.message }) });
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#edit-cancel').addEventListener('click', () => editDialog.close());

// Delete asks once more before the word goes (soft delete: deleted_at is set).
document.querySelector('#delete').addEventListener('click', () => {
  showDeleteStep(true);
  document.querySelector('#delete-cancel').focus();
});
document.querySelector('#delete-cancel').addEventListener('click', () => {
  showDeleteStep(false);
  document.querySelector('#delete').focus();
});

document.querySelector('#delete-confirm').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await softDeleteWord(editing.id);
    words = words.filter((w) => w.id !== editing.id);
    editDialog.close();
    render();
  } catch (err) {
    deleteError.textContent = t(lang, 'words.deleteError', { message: err.message });
    deleteError.hidden = false;
  } finally {
    button.disabled = false;
  }
});

// A click anywhere in a row opens its word, except on buttons and links or while selecting text.
rows.addEventListener('click', (event) => {
  if (event.target.closest('button, a') || !getSelection().isCollapsed) return;
  event.target.closest('tr')?.querySelector('a.v-word')?.click();
});

search.addEventListener('input', render);

let firstLoad = true;
async function load() {
  loadError.hidden = true;
  try {
    words = await listWords(profile.pair.id);
  } catch {
    empty.hidden = true;
    list.hidden = true;
    loadError.hidden = false;
    return;
  }
  render();

  if (firstLoad) {
    firstLoad = false;
    const id = new URLSearchParams(location.search).get('edit');
    const word = id && words.find((w) => w.id === id);
    if (word) openEdit(word);
  }
}

document.querySelector('#retry').addEventListener('click', load);
await load();
