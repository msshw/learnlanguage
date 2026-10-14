import { showForbidden, startAdminPage } from '../lib/admin-guard.js';
import { invokeAdmin } from '../lib/db.js';

const $ = (selector) => document.querySelector(selector);
const rejectedList = $('#rejected-entries');
const syncEmpty = () => {
  $('#rejected-empty').hidden = rejectedList.children.length > 0;
};

// One entry per rejection, from the rejected_senses store.
function renderRejected(entry) {
  const node = $('#rejected-template').content.firstElementChild.cloneNode(true);
  node.querySelector('.rejected-term').textContent = entry.term;
  node.querySelector('.rejected-meta').textContent = [
    `${entry.target_lang} to ${entry.native_lang}`,
    entry.part_of_speech,
    `rejected ${new Date(entry.rejected_at).toLocaleString()}`,
  ].join(' · ');
  node.querySelector('.rejected-trans').textContent = entry.translations.join(', ');
  const error = node.querySelector('.rejected-error');
  const button = node.querySelector('.rejected-allow');
  button.addEventListener('click', async () => {
    error.hidden = true;
    button.disabled = true;
    try {
      const result = await invokeAdmin({ action: 'allow_again', ids: entry.ids });
      if (result?.status !== 'ok') throw new Error(result?.status ?? 'no answer');
      node.remove();
      syncEmpty();
    } catch {
      error.textContent = 'Could not allow the sense again';
      error.hidden = false;
      button.disabled = false;
    }
  });
  return node;
}

async function loadRejected() {
  $('#rejected-load-error').hidden = true;
  try {
    const result = await invokeAdmin({ action: 'list_rejected' });
    if (result.status === 'forbidden') return 'forbidden';
    if (result.status !== 'ok' || !Array.isArray(result.entries)) throw new Error('bad answer');
    rejectedList.replaceChildren(...result.entries.map(renderRejected));
    syncEmpty();
  } catch {
    $('#rejected-load-error').hidden = false;
  }
}

$('#rejected-retry').addEventListener('click', async () => {
  if ((await loadRejected()) === 'forbidden') showForbidden();
});
await startAdminPage(loadRejected);
