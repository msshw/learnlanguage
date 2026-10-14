// A small bar for errors nobody handled. Caught errors show their own inline message instead.

// event: an 'error' or 'unhandledrejection' event.
export function shouldShow(event) {
  if (event.type === 'unhandledrejection') return true;
  // Browser noise arrives without an error object ("Script error.", ResizeObserver notices).
  if (!event.error) return false;
  return !String(event.message ?? '').startsWith('ResizeObserver');
}

let bar;

function showBar() {
  if (!bar) {
    bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.className =
      'fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900';
    const message = document.createElement('span');
    message.textContent = 'Something went wrong. Reload the page if it keeps happening.';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'underline';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => bar.remove());
    bar.append(message, dismiss);
  }
  if (!bar.isConnected) document.body.prepend(bar);
}

export function installErrorBar() {
  window.addEventListener('error', (event) => {
    if (!shouldShow(event)) return;
    console.error(event.error);
    showBar();
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error(event.reason);
    showBar();
  });
}
