// A shore contact picks where to go once per sign-in: "app" (own or crew boat) or "shore" (the monitoring map).
export const PICK_KEY = "mbp_shore_pick";

export const readPick = (uid) => {
  try { const p = JSON.parse(localStorage.getItem(PICK_KEY)); return p?.uid === uid ? p.to : null; } catch { return null; }
};

export const savePick = (uid, to) => localStorage.setItem(PICK_KEY, JSON.stringify({ uid, to }));
