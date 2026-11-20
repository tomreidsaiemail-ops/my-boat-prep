// Yellow highlight on an on-screen element for a moment (Welcome screen tours); resolves when it ends.
export const glow = (testId, ms = 1000) => new Promise((done) => {
  const els = [...document.querySelectorAll(`[data-testid="${testId}"]`)];
  els.forEach((e) => e.classList.add("mbp-glow"));
  setTimeout(() => { els.forEach((e) => e.classList.remove("mbp-glow")); done(); }, ms);
});
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A pretend home (name + tick/cross) shown on the home button and Home toggle for a moment, then put back.
export const previewHome = (name, mark, ms = 1000) => {
  window.dispatchEvent(new CustomEvent("mbp:home-preview", { detail: { name, mark } }));
  return wait(ms).then(() => window.dispatchEvent(new CustomEvent("mbp:home-preview", { detail: null })));
};
