import { useEffect } from "react";

// Yellow highlight on an on-screen element for a moment (Welcome screen tours); resolves when it ends.
export const glow = (testId, ms = 1000, cls = "mbp-glow") => new Promise((done) => {
  const els = [...document.querySelectorAll(`[data-testid="${testId}"]`)];
  els.forEach((e) => e.classList.add(cls));
  setTimeout(() => { els.forEach((e) => e.classList.remove(cls)); done(); }, ms);
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
