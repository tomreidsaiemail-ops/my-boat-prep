// Fish photos taken without a signal wait here (on this phone) with their GPS and time until the skipper identifies them.
const DB = "mbp_fish_queue";
const STORE = "catches";

const open = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const run = async (mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(out?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

export const queueCatch = (c) => run("readwrite", (s) => s.put({ ...c, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }));
export const queuedCatches = async (userId) => ((await run("readonly", (s) => s.getAll())) || [])
  .filter((c) => c.user_id === userId).sort((a, b) => a.taken_at.localeCompare(b.taken_at));
export const dropCatch = (id) => run("readwrite", (s) => s.delete(id));
export const updateCatch = async (id, patch) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const s = tx.objectStore(STORE);
    // One transaction, so a photo removed meanwhile isn't brought back.
    s.get(id).onsuccess = (e) => { if (e.target.result) s.put({ ...e.target.result, ...patch }); };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};
