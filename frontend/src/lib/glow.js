import { useEffect, useState } from "react";

// A yellow highlight held on MAYDAY, PAN-PAN and GPS in the header while Welcome's MAYDAY line is showing.
export const holdDistressHighlight = (on) => window.dispatchEvent(new CustomEvent("mbp:hold-distress", { detail: !!on }));
export const useDistressHighlight = () => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = (e) => setOn(e.detail);
    window.addEventListener("mbp:hold-distress", f);
    return () => window.removeEventListener("mbp:hold-distress", f);
  }, []);
  return on;
};

// Yellow highlight on an on-screen element for a moment (Welcome screen tours); resolves when it ends.
// Overlapping glows on one element are counted, so an earlier one ending doesn't cut a later one short.
const glowing = new WeakMap();
export const glow = (testId, ms = 1000, cls = "mbp-glow") => new Promise((done) => {
  const els = [...document.querySelectorAll(`[data-testid="${testId}"]`)];
  const count = (e, d) => { const m = glowing.get(e) || {}; m[cls] = (m[cls] || 0) + d; glowing.set(e, m); return m[cls]; };
  els.forEach((e) => { count(e, 1); e.classList.add(cls); });
  setTimeout(() => { els.forEach((e) => { if (count(e, -1) <= 0) e.classList.remove(cls); }); done(); }, ms);
});
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A pretend home (name + tick/cross) shown on the home button and Home toggle for a moment, then put back.
export const previewHome = (name, mark, ms = 1000) => {
  window.dispatchEvent(new CustomEvent("mbp:home-preview", { detail: { name, mark } }));
  return wait(ms).then(() => window.dispatchEvent(new CustomEvent("mbp:home-preview", { detail: null })));
};

// The list picker shows another list and the Home toggle a cross for a moment; the open list and home stay as they are.
export const previewList = (list, ms = 5000, pulse = false) => {
  window.dispatchEvent(new CustomEvent("mbp:home-preview", { detail: { mark: "cross", list, pulse } }));
  return wait(ms).then(() => window.dispatchEvent(new CustomEvent("mbp:home-preview", { detail: null })));
};

// Opens the app menu ("menu"), its Help drop-down ("help") or Help > Model Vessel ("model") for a Welcome "Show me".
export const openMenu = (what) => window.dispatchEvent(new CustomEvent("mbp:menu-open", { detail: what }));
export const closeMenu = (what) => window.dispatchEvent(new CustomEvent("mbp:menu-close", { detail: what }));
export const useMenuOpen = (what, setOpen) => useEffect(() => {
  const f = (e) => { if (e.detail === what) setOpen(true); };
  const g = (e) => { if (e.detail === what) setOpen(false); };
  window.addEventListener("mbp:menu-open", f);
  window.addEventListener("mbp:menu-close", g);
  return () => { window.removeEventListener("mbp:menu-open", f); window.removeEventListener("mbp:menu-close", g); };
}, [what, setOpen]);
