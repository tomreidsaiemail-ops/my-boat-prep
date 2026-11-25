// "!!-!!Highlight Lists" on a Model Vessel wizard step: while that step is on screen, the button or box named "Lists"
// (and its label or entry box) glows light green. Several: "!!-!!Highlight Hamburger, !!-!!Highlight Lists".
// A name is the thing's data-hl name (e.g. the menu button is "Hamburger"), else its label, aria-label, words or title.
const HL = /,?\s*!!-!!\s*highlight\s+([^,]*?)\s*(?=,|$|@@|!!-!!)/gi;
const TARGET = 'button, a[href], input, textarea, select, label, [role="button"], [role="tab"], [role="combobox"], [role="menuitem"], [role="checkbox"], [role="switch"], [data-hl]';
const clean = (s = "") => String(s).replace(/\s+/g, " ").replace(/(\.{3}|…)$/, "").replace(/[*:]+$/, "").trim();
const norm = (s) => clean(s).toLowerCase();

export const splitHighlights = (line = "") => {
  const names = [];
  const text = line.replace(HL, (_, n) => { const t = n.trim().replace(/\.$/, "").trim(); if (t) names.push(t); return ""; });
  return { text, names };
};

export const nameOf = (el) => {
  const hl = el.closest("[data-hl]");
  if (hl) return clean(hl.dataset.hl);
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return clean(el.labels?.[0]?.textContent || el.getAttribute("aria-label") || el.placeholder || "");
  return clean(el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || "").slice(0, 60);
};

const onScreen = (el) => el.getClientRects().length > 0 && !el.closest("[data-training-window]");
// Everything on screen with that name (not the parts inside another match), with its label or entry box.
const findByName = (name) => {
  const k = norm(name);
  const all = [...document.querySelectorAll(TARGET)].filter((el) => onScreen(el) && norm(nameOf(el)) === k);
  return all.filter((el) => !all.some((o) => o !== el && o.contains(el)))
    .flatMap((el) => [el, ...(el.tagName === "LABEL" && el.control ? [el.control] : []), ...(el.labels ? [...el.labels] : [])]);
};

// Keeps the named things lit while the step is up (they may appear later, e.g. when a menu opens); returns the clean-up.
export const highlightNames = (names = []) => {
  const clear = () => document.querySelectorAll(".training-hl").forEach((el) => el.classList.remove("training-hl"));
  if (!names.length) return clear;
  const paint = () => {
    const want = new Set(names.flatMap(findByName));
    document.querySelectorAll(".training-hl").forEach((el) => !want.has(el) && el.classList.remove("training-hl"));
    want.forEach((el) => el.classList.add("training-hl"));
  };
  paint();
  const id = setInterval(paint, 800);
  return () => { clearInterval(id); clear(); };
};

// Admin "?": the next tap anywhere outside the training window doesn't press anything, it just gives that thing's name.
export const pickName = (onPick) => {
  const ours = (e) => e.target?.closest?.("[data-training-window], [data-sonner-toaster]");
  let down = null;
  const block = (e) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
  const onDown = (e) => { if (ours(e)) return; block(e); down = e.target; };
  const onMouse = (e) => { if (!ours(e)) block(e); };
  const onClick = (e) => {
    if (ours(e)) return;
    block(e);
    const el = (down || e.target)?.closest?.(TARGET);
    stop();
    onPick(el ? nameOf(el) : "");
  };
  const stop = () => {
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("mousedown", onMouse, true);
    window.removeEventListener("click", onClick, true);
  };
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("mousedown", onMouse, true);
  window.addEventListener("click", onClick, true);
  return stop;
};
