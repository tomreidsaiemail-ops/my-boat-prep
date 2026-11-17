// "@@DOITFORME,START=Mana Marina,DESTINATION=Ship Cove, Marlborough Sounds" at the end of a wizard step:
// the "Do it for me" button types each value into the box on screen labelled with that name.
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
  el.dispatchEvent(new Event("blur", { bubbles: true }));
};
export const doItForMe = (fill) => {
  const done = [];
  const missing = [];
  fill.forEach(({ key, value }) => {
    const el = boxFor(key);
    if (el) { type(el, value); done.push(key); } else missing.push(key);
  });
  return { done, missing };
};
