import { getProfile, supabase } from './db.js';
import { t, uiLanguage } from './i18n.js';
import { lang, setLang } from './ui-lang.js';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

// Sends Supabase's password-reset email. The link opens Supabase's default reset flow.
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Redirects and never resolves, so the calling page module stops before it loads any data.
function leave(url) {
  location.replace(url);
  return new Promise(() => {});
}

// Reveals the page when signed in (unless `reveal` is false, for callers with more checks to run).
export async function requireSession({ reveal = true } = {}) {
  const session = await getSession();
  if (!session) {
    const returnTo = location.pathname + location.search;
    return leave(`/signin.html?returnTo=${encodeURIComponent(returnTo)}`);
  }
  if (reveal) document.body.hidden = false;
  return session;
}

// Replaces the page content with a message and a Retry button, and never resolves.
export function showLoadError() {
  const message = document.createElement('p');
  message.className = 'v-error';
  message.textContent = t(lang, 'auth.loadError');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'v-btn v-btn--secondary mt-3';
  retry.textContent = t(lang, 'common.retry');
  retry.addEventListener('click', () => location.reload());
  document.querySelector('main').replaceChildren(message, retry);
  document.body.hidden = false;
  return new Promise(() => {});
}

// Session plus an active language pair. The page stays hidden until both pass.
// Returns the profile with its active pair as `profile.pair` (languages and new_words_per_day).
export async function requireSetup() {
  await requireSession({ reveal: false });
  let profile;
  try {
    profile = await getProfile();
  } catch {
    return showLoadError();
  }
  if (!profile.pair) return leave('/setup.html');
  // The interface language is the active pair's native language.
  setLang(uiLanguage(profile.pair.native_lang));
  document.body.hidden = false;
  return profile;
}
