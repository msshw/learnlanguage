import { requireSetup } from '../lib/auth.js';
import { getWord } from '../lib/db.js';
import { articleBadge } from '../lib/word-form-view.js';
import { isWordId, wordLabel } from '../lib/word-list.js';

await requireSetup();

const $ = (selector) => document.querySelector(selector);
const loadError = $('#load-error');
const notFound = $('#not-found');
const article = $('#word');

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') location.assign('/words.html');
});

function show(word) {
  const badge = articleBadge(word);
  $('#term').replaceChildren(...(badge ? [badge, ' '] : []), word.term);
  document.title = `${wordLabel(word)} - Vocab`;
  $('#hint').textContent = word.hint_en ?? '';
  $('#hint').hidden = !word.hint_en;
  $('#pos').textContent = word.part_of_speech;
  $('#translations').textContent = word.translations.join(', ');
  $('#translations-section').hidden = word.translations.length === 0;
  $('#example-de').textContent = word.example_de ?? '';
  $('#example-de').hidden = !word.example_de;
  $('#example-en').textContent = word.example_en ?? '';
  $('#example-en').hidden = !word.example_en;
  $('#examples-section').hidden = !word.example_de && !word.example_en;
  article.hidden = false;
}

async function load() {
  loadError.hidden = true;
  const id = new URLSearchParams(location.search).get('id');
  let word = null;
  if (isWordId(id)) {
    try {
      word = await getWord(id);
    } catch {
      loadError.hidden = false;
      return;
    }
  }
  notFound.hidden = word !== null;
  if (word) show(word);
}

$('#retry').addEventListener('click', load);
await load();
