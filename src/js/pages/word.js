import { requireSetup } from '../lib/auth.js';
import { getWord } from '../lib/db.js';
import { articleBadge } from '../lib/word-form-view.js';
import { posLabel } from '../lib/i18n.js';
import { profileOf } from '../lib/languages.js';
import { lang } from '../lib/ui-lang.js';
import { isWordId, wordLabel } from '../lib/word-list.js';

const profile = await requireSetup();
const langProfile = profileOf(profile.pair.target_lang);

const $ = (selector) => document.querySelector(selector);
const loadError = $('#load-error');
const notFound = $('#not-found');
const article = $('#word');

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') location.assign('/words.html');
});

function show(word) {
  const badge = articleBadge(word, langProfile);
  $('#term').replaceChildren(...(badge ? [badge, ' '] : []), word.term);
  document.title = `${wordLabel(word)} - Vocab`;
  $('#hint').textContent = word.hint_native ?? '';
  $('#hint').hidden = !word.hint_native;
  $('#pos').textContent = posLabel(lang, word.part_of_speech);
  $('#translations').textContent = word.translations.join(', ');
  $('#translations-section').hidden = word.translations.length === 0;
  $('#example-target').textContent = word.example_target ?? '';
  $('#example-target').hidden = !word.example_target;
  $('#example-native').textContent = word.example_native ?? '';
  $('#example-native').hidden = !word.example_native;
  $('#examples-section').hidden = !word.example_target && !word.example_native;
  article.hidden = false;
}

async function load() {
  loadError.hidden = true;
  const id = new URLSearchParams(location.search).get('id');
  let word = null;
  if (isWordId(id)) {
    try {
      word = await getWord(id);
      if (word && word.pair_id !== profile.pair.id) word = null; // another of the user's pairs
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
