import { showForbidden, startAdminPage } from '../lib/admin-guard.js';
import { invokeAdmin } from '../lib/db.js';
import { buildWord, senseToFormValues } from '../lib/word-form.js';
import { fillSenseMeta, initWordForm, removeNotesAndTags } from '../lib/word-form-view.js';

const $ = (selector) => document.querySelector(selector);
const loadError = $('#load-error');
const empty = $('#empty');
const entries = $('#entries');

const syncEmpty = () => {
  empty.hidden = entries.children.length > 0;
};

const stateOf = (sense) => sense.state ?? 'candidate';
const isJudged = (sense) => stateOf(sense) === 'rejected' || sense.judged === true;

// The sense fields the server validates; notes and tags are not part of a suggestion.
const senseFromValue = (v) => ({
  term: v.term,
  part_of_speech: v.part_of_speech,
  translations: v.translations,
  hint_en: v.hint_en,
  forms: v.forms,
  example_de: v.example_de,
  example_en: v.example_en,
});

// Builds one entry. After an action the entry is replaced by render() of the updated data.
function render(entry) {
  const node = $('#entry-template').content.firstElementChild.cloneNode(true);
  const closed = entry.reports_closed === true;
  node.querySelector('.entry-term').textContent = entry.term;
  const count = `${entry.report_count} open ${entry.report_count === 1 ? 'report' : 'reports'}`;
  node.querySelector('.entry-meta').textContent = [
    `${entry.target_lang} to ${entry.native_lang}`,
    entry.status,
    count,
    `first reported ${new Date(entry.first_reported_at).toLocaleString()}`,
  ].join(' · ');
  node.querySelector('.entry-reasons').replaceChildren(
    ...(entry.reasons ?? []).map((reason) => {
      const li = document.createElement('li');
      li.textContent = reason;
      return li;
    }),
  );
  node.querySelector('.entry-closed').hidden = !closed;

  const error = node.querySelector('.entry-error');
  const lock = (disabled) => node.querySelectorAll('button').forEach((b) => (b.disabled = disabled));

  // Sends one action. On success the entry re-renders from the response; on failure nothing changes.
  const send = async (body, failure) => {
    error.hidden = true;
    lock(true);
    try {
      const result = await invokeAdmin({ suggestion_id: entry.suggestion_id, ...body });
      if (result?.status === 'invalid') {
        error.textContent = `The sense is not valid: ${result.error ?? 'check the fields'}`;
        error.hidden = false;
        lock(false);
        return;
      }
      if (result?.status !== 'ok' || !Array.isArray(result.senses)) throw new Error(result?.status ?? 'no answer');
      node.replaceWith(
        render({
          ...entry,
          senses: result.senses,
          reports_closed: result.reports_closed === true,
          status: result.senses.some((s) => stateOf(s) === 'confirmed') ? 'confirmed' : 'candidate',
        }),
      );
    } catch {
      error.textContent = failure;
      error.hidden = false;
      lock(false);
    }
  };

  node.querySelector('.entry-senses').replaceChildren(
    ...entry.senses.map((sense, index) => {
      const row = $('#entry-sense-template').content.firstElementChild.cloneNode(true);
      const state = stateOf(sense);
      row.querySelector('.v-sense__trans').textContent = sense.translations.join(', ');
      fillSenseMeta(row.querySelector('.sense-meta'), sense);
      row.querySelector('.v-sense__ex').textContent = sense.example_de ?? '';
      row.querySelector('.sense-state').textContent =
        state === 'rejected' ? 'Rejected' : `${state === 'confirmed' ? 'Confirmed' : 'Candidate'} · ${isJudged(sense) ? 'Judged' : 'Not judged'}`;

      const actions = row.querySelector('.sense-actions');
      if (state === 'rejected' || closed) {
        actions.remove();
        return row;
      }
      row.querySelector('.sense-approve').addEventListener('click', () =>
        send({ action: 'approve', sense_index: index }, 'Could not approve the sense'));
      row.querySelector('.sense-reject').addEventListener('click', () =>
        send({ action: 'reject', sense_index: index }, 'Could not reject the sense'));
      row.querySelector('.sense-edit').addEventListener('click', () => {
        const form = $('#edit-template').content.firstElementChild.cloneNode(true);
        removeNotesAndTags(form);
        const view = initWordForm(form);
        view.fill({ ...senseToFormValues(sense), notes: null, tags: [] });
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const built = buildWord(view.read());
          if (!built.ok) {
            view.showErrors(built.errors);
            return;
          }
          send(
            { action: 'edit', sense_index: index, sense: senseFromValue(built.value) },
            'Could not save the sense',
          );
        });
        form.querySelector('.edit-cancel').addEventListener('click', () => {
          row.querySelector('.sense-edit-slot').replaceChildren();
          actions.hidden = false;
        });
        actions.hidden = true;
        row.querySelector('.sense-edit-slot').replaceChildren(form);
        form.elements.term.focus();
      });
      return row;
    }),
  );

  const remove = node.querySelector('.entry-remove');
  if (closed) remove.remove();
  else remove.addEventListener('click', () => send({ action: 'remove' }, 'Could not remove the suggestion'));
  return node;
}


// Returns 'forbidden' for a non-admin; the guard then shows "Not available".
async function loadReports() {
  loadError.hidden = true;
  let result;
  try {
    result = await invokeAdmin({ action: 'list' });
    if (result.status !== 'forbidden' && (result.status !== 'ok' || !Array.isArray(result.entries))) {
      throw new Error('bad answer');
    }
  } catch {
    loadError.hidden = false;
    return;
  }
  if (result.status === 'forbidden') return 'forbidden';
  entries.replaceChildren(...result.entries.map(render));
  syncEmpty();
}

$('#retry').addEventListener('click', async () => {
  if ((await loadReports()) === 'forbidden') showForbidden();
});
await startAdminPage(loadReports);
