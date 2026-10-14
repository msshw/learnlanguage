import { requireSession, showLoadError } from '../lib/auth.js';
import { createActivePair, getProfile } from '../lib/db.js';

await requireSession({ reveal: false });
let profile;
try {
  profile = await getProfile();
} catch {
  await showLoadError();
}

if (profile.active_pair_id) {
  location.replace('/');
} else {
  document.body.hidden = false;

  const form = document.querySelector('#setup-form');
  const error = document.querySelector('#setup-error');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    button.disabled = true;
    try {
      await createActivePair('de', 'en');
      location.assign('/');
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      button.disabled = false;
    }
  });
}
