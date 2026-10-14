// DOM helpers for components/word-form.html, shared by the Add word and Words pages.
// All text goes in with textContent or .value, never innerHTML.

const TEXT_FIELDS = [
  'term', 'hint_native', 'example_target', 'example_native', 'notes',
  'plural', 'praeteritum', 'partizip2', 'separable_prefix',
];

// The Admin edit form is the same component without the personal fields.
export function removeNotesAndTags(form) {
  for (const name of ['notes', 'tags']) form.elements[name]?.closest('label')?.remove();
}

// profile: from languages.js. names: { target, native } language names for the labels.
export function initWordForm(form, profile, names) {
  const fields = form.elements;

  const labels = {
    term: `${names.target} word or phrase (without article)`,
    hint_native: `Hint for ${names.native} to ${names.target} prompts (optional)`,
    example_target: `Example sentence in ${names.target} (optional)`,
    example_native: `Example sentence in ${names.native} (optional)`,
  };
  for (const [name, text] of Object.entries(labels)) {
    const label = fields[name]?.closest('label')?.querySelector('.v-label');
    if (label) label.textContent = text;
  }

  // A group is shown only for the selected part of speech, and only when the profile has forms for it.
  const showFieldsForPartOfSpeech = () => {
    for (const group of form.querySelectorAll('[data-pos]')) {
      const pos = group.dataset.pos;
      group.hidden = pos !== fields.part_of_speech.value || !profile.forms[pos]?.length;
    }
  };
  fields.part_of_speech.addEventListener('change', showFieldsForPartOfSpeech);
  showFieldsForPartOfSpeech();

  const clearErrors = () => {
    for (const el of form.querySelectorAll('[data-error-for]')) {
      el.textContent = '';
      el.hidden = true;
    }
  };

  return {
    read: () => Object.fromEntries(new FormData(form)),

    reset() {
      form.reset();
      clearErrors();
      showFieldsForPartOfSpeech();
    },

    // word: a row from the words table
    fill(word) {
      form.reset();
      clearErrors();
      for (const key of TEXT_FIELDS) {
        if (!fields[key]) continue; // the Admin edit form has no notes
        fields[key].value = word[key] ?? word.forms?.[key] ?? '';
      }
      fields.part_of_speech.value = word.part_of_speech;
      fields.translations.value = word.translations.join(', ');
      if (fields.tags) fields.tags.value = word.tags.join(', ');
      if (fields.article) fields.article.value = word.forms?.article ?? '';
      if (fields.auxiliary) fields.auxiliary.value = word.forms?.auxiliary ?? '';
      showFieldsForPartOfSpeech();
    },

    clearErrors,

    showErrors(errors) {
      clearErrors();
      for (const [key, message] of Object.entries(errors)) {
        const el = form.querySelector(`[data-error-for="${key}"]`);
        if (!el) continue;
        el.textContent = message;
        el.hidden = false;
      }
    },
  };
}

// The article badge for a noun when the profile has articles, or null.
export function articleBadge(word, profile) {
  const article = word.part_of_speech === 'noun' ? word.forms?.article : null;
  if (!profile.articles.includes(article)) return null;
  const badge = document.createElement('span');
  badge.className = `v-art v-art--${article}`;
  badge.textContent = article;
  return badge;
}

// Fills the meta line of a sense: article badge, then "term, part of speech · hint". Shared by
// the Add word sense list and the Admin page.
export function fillSenseMeta(meta, sense, profile) {
  const badge = articleBadge(sense, profile);
  if (badge) meta.append(badge);
  const term = document.createElement('span');
  term.textContent = [`${sense.term}, ${sense.part_of_speech}`, sense.hint_native].filter(Boolean).join(' · ');
  meta.append(term);
}
