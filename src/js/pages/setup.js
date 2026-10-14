import { requireSession, showLoadError } from '../lib/auth.js';
import { createPair, getProfile } from '../lib/db.js';
import { pickLanguage, t } from '../lib/i18n.js';
import { fillSelect, nativeOptions, targetOptions } from '../lib/pair-form.js';
import { lang, setLang } from '../lib/ui-lang.js';

await requireSession({ reveal: false });
let profile;
try {
  profile = await getProfile();
} catch {
  await showLoadError();
}

if (profile.pair) {
  location.replace('/');
} else {
  document.body.hidden = false;
  // The pair does not exist yet: start from the browser's language, follow the native choice live.
  const browserLang = pickLanguage(navigator.languages);
  setLang(browserLang, { cache: false });

  const form = document.querySelector('#setup-form');
  const error = document.querySelector('#setup-error');
  const button = document.querySelector('#start');
  const native = document.querySelector('#native-lang');
  const target = document.querySelector('#target-lang');

  const refresh = () => {
    fillSelect(target, targetOptions(native.value, lang), target.value, t(lang, 'common.chooseLanguage'));
    button.disabled = !native.value || !target.value;
  };
  fillSelect(native, nativeOptions(lang), '', t(lang, 'common.chooseLanguage'));
  refresh();
  native.addEventListener('change', () => {
    const chosen = native.value;
    setLang(chosen || browserLang, { cache: false });
    fillSelect(native, nativeOptions(lang), chosen, t(lang, 'common.chooseLanguage'));
    refresh();
  });
  target.addEventListener('change', () => (button.disabled = !native.value || !target.value));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!native.value || !target.value) return;
    error.hidden = true;
    button.disabled = true;
    try {
      await createPair(target.value, native.value);
      location.assign('/');
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      button.disabled = false;
    }
  });
}
