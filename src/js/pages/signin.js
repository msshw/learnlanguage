import { sendPasswordReset, signIn } from '../lib/auth.js';
import { safeReturnTo } from '../lib/return-to.js';

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
    if (err.code === 'invalid_credentials') showError('Email or password is wrong', 'Check both and try again.');
    else showError('Could not sign in', err.message);
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
    showForgotStatus('Enter your email above, then select this link again.', true);
    form.email.focus();
    return;
  }
  try {
    await sendPasswordReset(email);
    showForgotStatus(`If ${email} has an account, a reset link is on its way.`, false);
  } catch (err) {
    showForgotStatus(err.message, true);
  }
});
