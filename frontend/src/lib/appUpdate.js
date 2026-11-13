// Unsynced boat changes on this phone, reported by the boat store so a forced sign-out can wait for them.
let sync = { pending: 0, online: true };
export const SYNC_EVENT = "mbp:sync-status";
export const reportSync = (pending, online) => { sync = { pending, online }; window.dispatchEvent(new Event(SYNC_EVENT)); };
export const syncStatus = () => sync;

export const UPDATED_PARAM = "updated";
export const CHECK_EVENT = "mbp:check-update";

export const clearAppCaches = async () => {
  try {
    if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch { /* nothing cached to clear */ }
};

// The deployed app's main script differs from the one this page is running.
export const newBuildOnServer = async () => {
  const script = document.querySelector('script[src*="/static/js/"]');
  if (!script || !navigator.onLine) return null;
  try {
    const res = await fetch("/asset-manifest.json", { cache: "no-store" });
    if (!res.ok) return null;
    const main = (await res.json())?.files?.["main.js"];
    return main && new URL(script.src).pathname !== main ? main : null;
  } catch { return null; }
};

export const reloadFresh = async () => {
  await clearAppCaches();
  window.location.reload();
};
