import { requireSetup } from '../lib/auth.js';
import { listWords, softDeleteWord, updateWord } from '../lib/db.js';
import { formatRelativeDay } from '../lib/format.js';
import { buildWord } from '../lib/word-form.js';
import { articleBadge, initWordForm } from '../lib/word-form-view.js';
import { matchesQuery, nextDue, wordLabel } from '../lib/word-list.js';

const profile = await requireSetup();

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
const editView = initWordForm(editForm);
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
      const due = nextDue(word.cards);
      const label = row.querySelector('.v-word');
      label.href = `/word.html?id=${word.id}`;
      const badge = articleBadge(word);
      // The space keeps "das Haus" readable as text, not "dasHaus".
      label.append(...(badge ? [badge, ' '] : []), word.term);
      if (word.hint_en) {
        const hint = document.createElement('p');
        hint.className = 'v-hint';
        hint.textContent = word.hint_en;
        row.querySelector('[data-cell="word"]').append(hint);
      }
      row.querySelector('[data-cell="translations"]').textContent = word.translations.join(', ');
      row.querySelector('[data-cell="due"]').textContent = due ? formatRelativeDay(due, now, profile.timezone) : '';
      const edit = row.querySelector('[data-action="edit"]');
      edit.setAttribute('aria-label', `Edit ${wordLabel(word)}`);
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
  const result = buildWord(editView.read());
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
    editView.showErrors({ form: `Could not save the word: ${err.message}` });
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
    deleteError.textContent = `Could not delete the word: ${err.message}`;
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
    words = await listWords(profile.active_pair_id);
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
