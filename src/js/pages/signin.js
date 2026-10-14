import { sendPasswordReset, signIn } from '../lib/auth.js';
import { pickLanguage, t } from '../lib/i18n.js';
import { safeReturnTo } from '../lib/return-to.js';
import { lang, setLang } from '../lib/ui-lang.js';

// No pair yet: the browser's language decides, and is not remembered.
setLang(pickLanguage(navigator.languages), { cache: false });

const form = document.querySelector('#signin-form');
const error = document.querySelector('#signin-error');
const button = form.querySelector('button[type="submit"]');
const forgot = document.querySelector('#forgot');
const forgotStatus = document.querySelector('#forgot-status');

function showError(title, body) {
  error.querySelector('.v-feedback__title').textContent = title;
  error.querySelector('.v-feedback__body').textContent = body;
  error.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  button.disabled = true;

  try {
    await signIn(form.email.value.trim(), form.password.value);
    const returnTo = new URLSearchParams(location.search).get('returnTo');
    location.assign(safeReturnTo(returnTo, location.origin));
  } catch (err) {
    if (err.code === 'invalid_credentials') showError(t(lang, 'signin.wrongTitle'), t(lang, 'signin.wrongBody'));
    else showError(t(lang, 'signin.failTitle'), err.message);
    form.password.value = '';
    form.password.focus();
    button.disabled = false;
  }
});

function showForgotStatus(text, isError) {
  forgotStatus.className = isError ? 'v-error' : 'v-hint';
  forgotStatus.textContent = text;
  forgotStatus.hidden = false;
}

forgot.addEventListener('click', async (event) => {
  event.preventDefault();
  const email = form.email.value.trim();
  if (!form.email.checkValidity() || !email) {
    showForgotStatus(t(lang, 'signin.forgotNeedEmail'), true);
    form.email.focus();
    return;
  }
  try {
    await sendPasswordReset(email);
    showForgotStatus(t(lang, 'signin.resetSent', { email }), false);
  } catch (err) {
    showForgotStatus(err.message, true);
  }
});
