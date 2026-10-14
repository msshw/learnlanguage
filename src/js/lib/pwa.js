// The worker caches the static shell only. Dev builds skip it so it cannot fight hot reload.
export function registerWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker not registered', err));
}
