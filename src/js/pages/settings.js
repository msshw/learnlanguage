import { getUsage } from '../lib/ai.js';
import { getSession, requireSetup, signOut } from '../lib/auth.js';
import { exportRows, updateProfileLimit } from '../lib/db.js';
import { buildExport, exportFilename } from '../lib/export.js';
import { formatUsage, parseLimit } from '../lib/settings.js';

const profile = await requireSetup();

const $ = (selector) => document.querySelector(selector);
const limitForm = $('#limit-form');
const limitInput = $('#limit');
const limitError = $('#limit-error');
const limitSaved = $('#limit-saved');
const limitButton = limitForm.querySelector('button[type="submit"]');

limitInput.value = profile.new_words_per_day;
getSession().then((session) => {
  $('#email').textContent = session?.user.email ?? '';
});

limitForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  limitSaved.hidden = true;
  limitError.hidden = true;
  const parsed = parseLimit(limitInput.value);
  if (!parsed.ok) {
    limitError.textContent = parsed.error;
    limitError.hidden = false;
    return;
  }
  limitButton.disabled = true;
  try {
    await updateProfileLimit(parsed.value);
    limitSaved.hidden = false;
  } catch (err) {
    limitError.textContent = `Could not save the limit: ${err.message}`;
    limitError.hidden = false;
  } finally {
    limitButton.disabled = false;
  }
});

// The usage line never blocks the rest of the page.
getUsage().then((usage) => {
  $('#usage').textContent = usage ? formatUsage(usage.spent, usage.cap) : 'Usage unavailable';
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
    exportError.textContent = `Could not export your data: ${err.message}`;
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
    signOutError.textContent = `Could not sign out: ${err.message}`;
    signOutError.hidden = false;
    signOutButton.disabled = false;
  }
});
