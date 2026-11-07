// Laminated QR cards inside each cupboard open My Boat Prep straight to a Magic Scan into that boat area.
const KEY = "mbp_qr_scan";
const TTL = 30 * 60 * 1000;

export const qrUrl = (boat, ownerId, areaId) =>
  `${window.location.origin}/?scan_area=${encodeURIComponent(areaId)}&b=${encodeURIComponent(boat.boat_id)}&o=${encodeURIComponent(boat.owner_id || ownerId)}`;

// Runs once on page load, before any login redirect, so the scan survives signing in.
export const captureQr = () => {
  const p = new URLSearchParams(window.location.search);
  const area = p.get("scan_area");
  if (!area) return;
  localStorage.setItem(KEY, JSON.stringify({ area, b: p.get("b") || "", o: p.get("o") || "", at: Date.now() }));
  ["scan_area", "b", "o"].forEach((k) => p.delete(k));
  window.history.replaceState(null, "", `${window.location.pathname}${p.toString() ? `?${p}` : ""}`);
};

export const pendingQr = () => {
  try {
    const q = JSON.parse(localStorage.getItem(KEY));
    if (q && Date.now() - q.at < TTL) return q;
  } catch { /* ignore */ }
  localStorage.removeItem(KEY);
  return null;
};

export const clearQr = () => localStorage.removeItem(KEY);

// The boat key in this phone's boat list: the skipper's own boat, or the skipper's boat as crew.
export const qrBoatKey = (q, userId) => (!q.o || q.o === userId ? q.b : `c_${q.o}_${q.b}`);
