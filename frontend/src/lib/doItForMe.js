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
// Times: NOW, NOW+6 / NOW-30 (minutes), TODAY, TODAY+1 (days), optionally "at 07:00". null when the value isn't a time.
const pad = (n) => String(n).padStart(2, "0");
export const parseWhen = (value) => {
  const m = String(value).trim().match(/^(now|today)\s*(?:([+-])\s*(\d+))?(?:\s*at\s*(\d{1,2}):?(\d{2}))?$/i);
  if (!m) return null;
  const [, word, sign, num, hh, mm] = m;
  const d = new Date();
  const n = (sign === "-" ? -1 : 1) * Number(num || 0);
  if (word.toLowerCase() === "now") d.setMinutes(d.getMinutes() + n);
  else d.setDate(d.getDate() + n);
  const timed = word.toLowerCase() === "now" || hh !== undefined;
  if (hh !== undefined) d.setHours(Number(hh), Number(mm), 0, 0);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: timed ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : null };
};
const tick = () => new Promise((r) => setTimeout(r, 60));

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
// A NOW/TODAY value goes into date, time or date-and-time boxes; a date box's time box beside it gets the time.
const put = async (el, value) => {
  const when = parseWhen(value);
  if (!when) return type(el, value);
  if (el.type === "datetime-local") return type(el, `${when.date}T${when.time || "00:00"}`);
  if (el.type === "time") return when.time && type(el, when.time);
  if (el.type !== "date") return type(el, when.time ? `${when.date} ${when.time}` : when.date);
  type(el, when.date);
  if (!when.time) return undefined;
  await tick();
  const time = el.parentElement?.querySelector('input[type="time"]');
  return time && type(time, when.time);
};

// One box at a time, letting the screen catch up in between (a box may depend on the one before).
export const doItForMe = async (fill) => {
  const done = [];
  const missing = [];
  for (const { key, value } of fill) {
    const el = boxFor(key);
    if (!el) { missing.push(key); continue; }
    if (!done.length) el.scrollIntoView({ behavior: "smooth", block: "center" });
    await put(el, value);
    done.push(key);
    await tick();
  }
  return { done, missing };
};
