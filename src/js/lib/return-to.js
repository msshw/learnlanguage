// Pure: no DOM, no globals. `origin` is passed in so it is testable.
const HOME = '/';

export function safeReturnTo(value, origin) {
  if (typeof value !== 'string') return HOME;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return HOME;

  let url;
  try {
    url = new URL(value, origin);
  } catch {
    return HOME;
  }
  if (url.origin !== origin) return HOME;
  if (url.pathname === '/signin.html' || url.pathname === '/signin') return HOME;
  return url.pathname + url.search + url.hash;
}
