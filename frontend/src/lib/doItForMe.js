// "@@DOITFORME,START=Mana Marina,DESTINATION=Ship Cove, Marlborough Sounds" at the end of a wizard step:
// the "Do it for me" button types each value into the box on screen labelled exactly with that name (or its aria-label).
const MARK = /@@DOITFORME/i;
const norm = (s = "") => s.replace(/[*:]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export const splitDoItForMe = (line) => {
  const at = line.search(MARK);
  if (at < 0) return { text: line, fill: null };
  const rest = line.slice(at).replace(MARK, "");
  const parts = rest.split(/,\s*([A-Za-z][\w ]*?)\s*=/);
  const fill = [];
  for (let n = 1; n < parts.length; n += 2) fill.push({ key: parts[n].trim(), value: parts[n + 1].trim().replace(/\.$/, "").trim() });
  return { text: line.slice(0, at), fill };
};

const shown = (el) => el.getClientRects().length > 0 && !el.disabled && !el.readOnly && !el.closest("[data-training-window]");
const boxFor = (key) => {
  const k = norm(key);
  for (const label of document.querySelectorAll("label")) {
    if (norm(label.textContent) !== k) continue;
    const el = label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector("input, textarea");
    if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && shown(el)) return el;
  }
  return [...document.querySelectorAll("input, textarea")].find((el) => shown(el) && norm(el.getAttribute("aria-label") || "") === k);
};
// Sets the value the way typing does, so the app's own change handlers save it.
const type = (el, value) => {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  // A short amber flash so the skipper sees what changed.
  el.classList.remove("do-it-flash");
  void el.offsetWidth;
  el.classList.add("do-it-flash");
  setTimeout(() => el.classList.remove("do-it-flash"), 1800);
};
// One box at a time, letting the screen catch up in between (a box may depend on the one before).
export const doItForMe = async (fill) => {
  const done = [];
  const missing = [];
  for (const { key, value } of fill) {
    const el = boxFor(key);
    if (!el) { missing.push(key); continue; }
    if (!done.length) el.scrollIntoView({ behavior: "smooth", block: "center" });
    type(el, value);
    done.push(key);
    await new Promise((r) => setTimeout(r, 60));
  }
  return { done, missing };
};
