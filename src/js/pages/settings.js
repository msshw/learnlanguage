import { getUsage } from '../lib/ai.js';
import { getSession, requireSetup, signOut } from '../lib/auth.js';
import { createPair, exportRows, updatePairLimit } from '../lib/db.js';
import { languageLabel, t } from '../lib/i18n.js';
import { fillSelect, nativeOptions, targetOptions } from '../lib/pair-form.js';
import { buildExport, exportFilename } from '../lib/export.js';
import { formatUsage, parseLimit } from '../lib/settings.js';
import { lang } from '../lib/ui-lang.js';

const profile = await requireSetup();

const $ = (selector) => document.querySelector(selector);
const limitForm = $('#limit-form');
const limitInput = $('#limit');
const limitError = $('#limit-error');
const limitSaved = $('#limit-saved');
const limitButton = limitForm.querySelector('button[type="submit"]');

limitInput.value = profile.pair.new_words_per_day;
$('#pair').textContent = `${languageLabel(lang, profile.pair.target_lang)} ← ${languageLabel(lang, profile.pair.native_lang)}`;

const addForm = $('#add-language-form');
const addNative = $('#add-native');
const addTarget = $('#add-target');
const addButton = $('#add-language');
const addError = $('#add-error');
fillSelect(addNative, nativeOptions(lang), profile.pair.native_lang);
const refreshTargets = () => {
  fillSelect(addTarget, targetOptions(addNative.value, lang), addTarget.value, t(lang, 'common.chooseLanguage'));
  addButton.disabled = !addTarget.value;
};
refreshTargets();
addNative.addEventListener('change', refreshTargets);
addTarget.addEventListener('change', () => (addButton.disabled = !addTarget.value));
addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!addTarget.value) return;
  addError.hidden = true;
  addButton.disabled = true;
  try {
    await createPair(addTarget.value, addNative.value);
    location.assign('/');
  } catch (err) {
    addError.textContent = t(lang, 'settings.addLanguageError', { message: err.message });
    addError.hidden = false;
    addButton.disabled = false;
  }
});
getSession().then((session) => {
  $('#email').textContent = session?.user.email ?? '';
});

limitForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  limitSaved.hidden = true;
  limitError.hidden = true;
  const parsed = parseLimit(limitInput.value, lang);
  if (!parsed.ok) {
    limitError.textContent = parsed.error;
    limitError.hidden = false;
    return;
  }
  limitButton.disabled = true;
  try {
    await updatePairLimit(profile.pair.id, parsed.value);
    limitSaved.hidden = false;
  } catch (err) {
    limitError.textContent = t(lang, 'settings.limitError', { message: err.message });
    limitError.hidden = false;
  } finally {
    limitButton.disabled = false;
  }
});

// The usage line never blocks the rest of the page.
getUsage().then((usage) => {
  $('#usage').textContent = usage ? formatUsage(usage.spent, usage.cap, lang) : t(lang, 'settings.usageUnavailable');
  if (!usage || usage.cap <= 0) return;
  $('#usage-bar span').style.width = `${Math.min(100, (usage.spent / usage.cap) * 100)}%`;
  $('#usage-bar').hidden = false;
});

const exportButton = $('#export');
const exportError = $('#export-error');
exportButton.addEventListener('click', async () => {
  exportError.hidden = true;
  exportButton.disabled = true;
  try {
    const now = new Date();
    const blob = new Blob([JSON.stringify(buildExport(await exportRows(), now), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename(now, profile.timezone);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    exportError.textContent = t(lang, 'settings.exportError', { message: err.message });
    exportError.hidden = false;
  } finally {
    exportButton.disabled = false;
  }
});

const signOutButton = $('#signout');
const signOutError = $('#signout-error');
signOutButton.addEventListener('click', async () => {
  signOutError.hidden = true;
  signOutButton.disabled = true;
  try {
    await signOut();
    location.assign('/signin.html');
  } catch (err) {
    signOutError.textContent = t(lang, 'settings.signOutError', { message: err.message });
    signOutError.hidden = false;
    signOutButton.disabled = false;
  }
});
