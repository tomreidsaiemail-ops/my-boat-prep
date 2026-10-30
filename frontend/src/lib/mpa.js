// Marine Magic Provisioning Assistant: meal plan parsing and the unified shopping list.
import { withoutYouTube } from "@/lib/youtube";
const BRACKET = /^\s*\[.*\]\s*$/s;
const UNITS = {
  g: ["g", 1], gram: ["g", 1], grams: ["g", 1], gr: ["g", 1], kg: ["g", 1000], kgs: ["g", 1000],
  ml: ["ml", 1], l: ["ml", 1000], lt: ["ml", 1000], litre: ["ml", 1000], litres: ["ml", 1000], liter: ["ml", 1000], liters: ["ml", 1000],
  tsp: ["tsp", 1], teaspoon: ["tsp", 1], teaspoons: ["tsp", 1], tbsp: ["tbsp", 1], tablespoon: ["tbsp", 1], tablespoons: ["tbsp", 1],
  cup: ["cup", 1], cups: ["cup", 1], pinch: ["pinch", 1], pinches: ["pinch", 1], clove: ["clove", 1], cloves: ["clove", 1],
  can: ["can", 1], cans: ["can", 1], tin: ["can", 1], tins: ["can", 1], pack: ["pack", 1], packs: ["pack", 1], packet: ["pack", 1], packets: ["pack", 1],
  slice: ["slice", 1], slices: ["slice", 1], x: ["count", 1], pcs: ["count", 1], pc: ["count", 1],
};
export const MPA_KIND = "mpa";
export const MPA_NAME = "MPA Shopping List";

const groupsOf = (items) => items.reduce((gs, it, i) => {
  if (i > 0 && it.indent && gs.length) gs[gs.length - 1].push(it);
  else gs.push([it]);
  return gs;
}, []);
const tidy = (s) => String(s || "").replace(/^\s*\d+[.)]\s*/, "").trim();

export const parseMeals = (items = []) => groupsOf(items)
  .filter((g) => g.length >= 2 && g[1].indent && BRACKET.test(g[1].label || ""))
  .map((g) => ({ name: tidy(g[0].label), type: g[0].meal_type, recipe: g[1].label.trim().slice(1, -1).trim(), ingredients: g.slice(2).map((i) => withoutYouTube(i.label)).filter(Boolean) }))
  .filter((m) => m.name);

// A meal is a top-level item whose first sub-item is a [recipe] line.
export const isMealHead = (items, id) => {
  const k = items.findIndex((i) => i.id === id);
  return k >= 0 && !(k > 0 && items[k].indent) && !!items[k + 1]?.indent && BRACKET.test(items[k + 1].label || "");
};

export const mealPlanLists = (registry = [], data = {}) => registry
  .filter((l) => l.kind !== MPA_KIND && Array.isArray(data[l.id]))
  .map((l) => ({ id: l.id, name: l.name, meals: parseMeals(data[l.id]) }))
  .filter((l) => l.meals.length > 0);

export const initialsFor = (names) => {
  const used = {};
  return names.map((n) => {
    const base = String(n).replace(/'s\b/gi, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "L";
    let tag = base;
    for (let k = 2; used[tag]; k += 1) tag = `${base}${k}`;
    used[tag] = true;
    return tag;
  });
};

const num = (s) => (s.includes("/") ? s.split("/").map(Number).reduce((a, b) => a / b) : Number(s.replace(",", ".")));
const unitOf = (w) => UNITS[String(w || "").toLowerCase().replace(/\.$/, "")];

export const parseQty = (label) => {
  const s = label.trim();
  const lead = s.match(/^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (lead && lead[2]) {
    const w = lead[2].match(/^([A-Za-z]+\.?)(?![A-Za-z])\s*(?:of\s+)?(.*)$/);
    const u = w && w[2] && unitOf(w[1]);
    const name = (u ? w[2] : lead[2]).trim();
    if (name) return { name, qty: num(lead[1].replace(/\s/g, "")), unit: u ? u[0] : "count", factor: u ? u[1] : 1 };
  }
  const trail = s.match(/^(.*?)[\s,:–-]+x?\s*(\d+(?:[.,]\d+)?)\s*([A-Za-z]+\.?)?$/);
  if (trail && trail[1] && (!trail[3] || unitOf(trail[3]))) {
    const u = unitOf(trail[3]);
    return { name: trail[1].trim(), qty: num(trail[2]), unit: u ? u[0] : "count", factor: u ? u[1] : 1 };
  }
  return { name: s, qty: null };
};

export const keyOf = (name) => {
  const words = String(name).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/);
  const last = words.pop() || "";
  const single = last.endsWith("ies") ? `${last.slice(0, -3)}y` : /(oes|ches|shes|xes|sses)$/.test(last) ? last.slice(0, -2) : /[^s]s$/.test(last) ? last.slice(0, -1) : last;
  return [...words, single].join(" ");
};

const round1 = (n) => Math.round(n * 10) / 10;
const fmtAmount = (unit, q) => {
  if (unit === "g") return q >= 1000 ? `${round1(q / 1000)} kg` : `${Math.ceil(q / 10) * 10} g`;
  if (unit === "ml") return q >= 1000 ? `${round1(q / 1000)} L` : `${Math.ceil(q / 10) * 10} ml`;
  if (unit === "count") return `${Math.ceil(q)}`;
  const v = unit === "pinch" || unit === "clove" || unit === "can" || unit === "pack" || unit === "slice" ? Math.ceil(q) : round1(q);
  return `${v} ${unit}${v === 1 || unit === "tsp" || unit === "tbsp" ? "" : unit === "pinch" ? "es" : "s"}`;
};

export const mpaLabel = ({ base, src = [], meals = [] }) => [base, src.map((s) => `(${s})`).join(""), meals.map((n) => `[${n}]`).join("")].filter(Boolean).join(" ");

// Print/PDF text for MPA rows: badges become words, like the emailed log (only while the row is unedited).
export const mpaPrintText = (item, text) => {
  const m = item.mpa;
  if (!m || text !== mpaLabel(m)) return text;
  const subs = (m.subs || []).flatMap((x) => x.areas.map((a) => `${a}: ${x.name}`));
  const tags = [...(m.prov ? ["PROV"] : []), ...(m.areas?.length ? [`On board: ${m.areas.join(", ")}`] : []), ...(subs.length ? [`On board instead: ${subs.join(", ")}`] : [])];
  return tags.length ? `${text} · ${tags.join(" · ")}` : text;
};

export const foodStock = (areas = []) => {
  const stock = {};
  areas.filter((a) => a.food).forEach((a) => (a.items || []).filter((i) => !i.removed).forEach((i) => {
    const q = i.qty == null || i.qty === "" ? 1 : Number(i.qty) || 0;
    if (q <= 0) return;
    const k = keyOf(i.name);
    stock[k] = { name: stock[k]?.name || i.name, qty: (stock[k]?.qty || 0) + q, areas: [...new Set([...(stock[k]?.areas || []), a.name])] };
  }));
  return stock;
};

// Wider matching for the food-area check, from the private admin lists "Admin - Food Synonyms" and "Admin - Food Noise Words".
// Names are split on "and", "&" and commas; noise words and patterns (e.g. fresh, [0-9]g) are removed; synonym groups
// (a heading with items indented under it, or a line "table salt = sea salt") link names. Each group stays separate.
const RE_CHARS = /[[\]\\^$.*+?(){}|]/;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const splitParts = (name) => String(name || "").split(/\s*(?:,|&|\band\b)\s*/i).map((x) => x.trim()).filter(Boolean);
// Noise patterns must never wipe a whole name: one that matches nothing at all (e.g. "(.*)") is read with literal
// brackets, so "(.*)" strips "(finely chopped)"; any pattern that still matches an empty or plain word is skipped.
const SAFE_WORD = "salt";
const compileNoise = (line) => {
  let re;
  try { re = new RegExp(line, "i"); } catch { return null; }
  if (re.test("") || re.test(SAFE_WORD)) {
    try { re = new RegExp(line.replace(/\\?([()])/g, "\\$1").replace(/([*+])(?!\?)/g, "$1?"), "i"); } catch { return null; }
  }
  return re.test("") || re.test(SAFE_WORD) ? null : re;
};
const noiseRules = (items = []) => items.reduce((acc, i) => {
  const line = tidy(i.label);
  if (!line) return acc;
  if (!RE_CHARS.test(line)) { acc.words.push(line.toLowerCase()); return acc; }
  const re = compileNoise(line);
  // Patterns with literal brackets or spaces cut text spans; the rest drop whole words (e.g. [0-9]g drops "250g").
  if (re && /\\\(|\s/.test(re.source)) acc.spans.push(new RegExp(re.source, "gi"));
  else if (re) acc.patterns.push(re);
  return acc;
}, { words: [], patterns: [], spans: [] });
const stripNoise = (name, noise) => {
  let x = ` ${String(name).toLowerCase()} `;
  noise.spans.forEach((re) => { x = x.replace(re, " "); });
  noise.words.forEach((w) => { x = x.replace(new RegExp(`(^|[^a-z0-9])${escapeRe(w)}(?=$|[^a-z0-9])`, "gi"), "$1 "); });
  return x.split(/\s+/).filter((t) => t && !noise.patterns.some((re) => re.test(t))).join(" ");
};
const plain = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean).join(" ");
// The words that name the food: "pepper to taste" -> "pepper".
const headOf = (s) => s.replace(/\s+(?:to|for|as|if)\s.*$/, "");
const wordOf = (name, noise) => headOf(plain(stripNoise(name, noise)));
const synGroups = (items, noise) => groupsOf(items).flatMap((g) => {
  const words = (g.length > 1 ? g.map((i) => i.label) : g[0].label.split(/\s*(?:=|→|->)\s*/)).map((w) => wordOf(tidy(w), noise)).filter(Boolean);
  return words.length > 1 ? [[...new Set(words)].map((raw) => ({ raw, key: keyOf(raw) }))] : [];
});
export const matchRules = ({ synonyms = [], noise = [] } = {}) => {
  const nz = noiseRules(noise);
  return { noise: nz, groups: synGroups(synonyms, nz) };
};
const NO_RULES = matchRules();
const endsWithWord = (s, w) => s === w || s.endsWith(` ${w}`);
// A name joins a group when it is, or ends with, one of its words ("Sea salt" -> Salt, but "Chilli pickle" is a pickle, not chilli).
// The most specific word wins ("Red bell pepper" -> Bell Peppers, not Pepper); on a tie the exact spelling beats singular/plural,
// so "pepper" finds the Pepper group and "peppers" the Peppers group.
const groupsFor = (word, rules) => {
  const key = keyOf(word);
  const fit = (w) => (endsWithWord(word, w.raw) ? w.raw.split(" ").length * 2 + 1 : endsWithWord(key, w.key) ? w.key.split(" ").length * 2 : 0);
  const scores = rules.groups.map((g) => Math.max(0, ...g.map(fit)));
  const best = Math.max(0, ...scores);
  return best ? scores.flatMap((sc, i) => (sc === best ? [`#${i}`] : [])) : [];
};
// Everything a name stands for: its own key plus its synonym groups. Matching is two-way: names match when these overlap.
const conceptsOf = (name, rules) => splitParts(rules.noise.spans.reduce((x, re) => x.replace(re, " "), String(name || ""))).flatMap((part) => {
  const w = wordOf(part, rules.noise);
  return w ? [keyOf(w), ...groupsFor(w, rules)] : [];
});
// Food-area items that might do instead (only when the item isn't on board under its own name).
const subsFor = (k, name, stock, rules) => {
  if (stock[k]) return [];
  const r = rules || NO_RULES;
  const want = new Set(conceptsOf(name, r));
  return Object.entries(stock)
    .filter(([sk, st]) => sk !== k && conceptsOf(st.name, r).some((c) => want.has(c)))
    .map(([, st]) => ({ name: st.name, areas: st.areas }));
};

const ingredientRows = (lists, portions, stock, rules) => {
  const rows = new Map();
  let n = 0;
  const meals = [];
  lists.forEach((l) => l.meals.forEach((m) => {
    n += 1;
    meals.push({ n, name: m.name, src: l.tag });
    m.ingredients.forEach((raw) => {
      const p = parseQty(withoutYouTube(raw));
      const k = keyOf(p.name);
      if (!k) return;
      const r = rows.get(k) || { name: p.name.charAt(0).toUpperCase() + p.name.slice(1), amounts: {}, src: new Set(), meals: new Set() };
      if (p.qty != null) r.amounts[p.unit] = (r.amounts[p.unit] || 0) + p.qty * p.factor * portions;
      r.src.add(l.tag);
      r.meals.add(n);
      rows.set(k, r);
    });
  }));
  const items = [...rows.entries()].map(([k, r]) => {
    const have = stock[k]?.qty || 0;
    const amounts = { ...r.amounts };
    let note = "";
    if (have && amounts.count != null) {
      amounts.count = Math.max(0, amounts.count - have);
      note = ` · ${have} on board`;
      if (!amounts.count) delete amounts.count;
    } else if (have) note = ` · ${have} on board`;
    const covered = !!have && Object.keys(r.amounts).length > 0 && Object.keys(amounts).length === 0;
    const amt = Object.entries(amounts).map(([u, q]) => fmtAmount(u, q)).join(" + ");
    const base = `${r.name}${covered ? " – on board already" : amt ? ` – ${amt}` : ""}${covered ? "" : note}`;
    return { base, src: [...r.src], meals: [...r.meals].sort((a, b) => a - b), areas: stock[k]?.areas || [], subs: subsFor(k, r.name, stock, rules), checked: covered };
  });
  return { meals, items };
};

export const MEAL_TYPES = [
  { id: "breakfast", one: "Breakfast", many: "Breakfasts", re: /\b(breakfast|brekkie|brunch)/i },
  { id: "lunch", one: "Lunch", many: "Lunches", re: /\blunch/i },
  { id: "dinner", one: "Dinner / main", many: "Dinners / mains", re: /\b(dinner|mains?\b|supper|evening meal)/i },
  { id: "dessert", one: "Dessert", many: "Desserts", re: /\b(dessert|pudding|puds?\b)/i },
  { id: "snack", one: "Snack", many: "Snacks", re: /\bsnack/i },
];
// "First type in the name" = the type word that appears earliest.
export const detectMealType = (name) => {
  let best = null;
  let at = Infinity;
  MEAL_TYPES.forEach((t) => { const m = t.re.exec(name || ""); if (m && m.index < at) { at = m.index; best = t.id; } });
  return best;
};

// Meals without a picked type get one from their name (marked meal_type_auto so it follows renames).
export const autoMealTypes = (items) => {
  if (!Array.isArray(items)) return items;
  let changed = false;
  const out = items.map((it, k) => {
    if (it.meal_type && !it.meal_type_auto) return it;
    const head = !(k > 0 && it.indent) && !!items[k + 1]?.indent && BRACKET.test(items[k + 1].label || "");
    const t = head ? detectMealType(tidy(it.label)) : null;
    if ((it.meal_type || null) === t) return it;
    changed = true;
    const { meal_type: _t, meal_type_auto: _a, ...rest } = it;
    return t ? { ...rest, meal_type: t, meal_type_auto: true } : rest;
  });
  return changed ? out : items;
};

// Runs on lists that changed since `prev` (or all lists without it); returns the same object when nothing changes.
export const autoTypeData = (data, prev) => {
  if (!data) return data;
  let changed = false;
  const out = {};
  Object.entries(data).forEach(([k, v]) => {
    const n = prev && prev[k] === v ? v : autoMealTypes(v);
    if (n !== v) changed = true;
    out[k] = n;
  });
  return changed ? out : data;
};
const EXTRA_TYPES = ["dessert", "snack"];
// A picked meal type wins; otherwise the type is read from words in the meal name.
const typesOf = (m) => (m.type ? [m.type] : MEAL_TYPES.filter((t) => t.re.test(m.name)).map((t) => t.id));

// Soft checks before making the list: too many main meals for the trip (desserts and snacks don't count), and missing meal types.
export const mpaWarnings = (meals, days) => {
  const d = days || 1;
  const max = d * 3;
  const out = [];
  const main = meals.filter((m) => { const t = typesOf(m); return !t.length || t.some((x) => !EXTRA_TYPES.includes(x)); }).length;
  const extras = meals.length - main;
  if (main > max) out.push({ id: "count", text: `${main} meals${extras ? ` (not counting ${extras} desserts and snacks)` : ""} are picked for a ${d}-day trip, which allows up to ${max} (3 a day).${days ? "" : " Trip duration isn't set, so 1 day is used. Set it in Additional boat details."}` });
  const found = new Set(meals.flatMap(typesOf));
  const missing = MEAL_TYPES.filter((t) => !found.has(t.id)).map((t) => t.many);
  if (meals.length && missing.length) out.push({ id: "types", text: `No ${missing.join(", ").toLowerCase()} found. Set a meal's type when editing it, or use the word in its name.` });
  return out;
};

export const itemName = (label) => String(label).split(" – ")[0].trim();

export const buildShopping = ({ lists, adults, children, days, stock, provisions = [], amounts = {}, aisleOf = null, aisleOrder = [], rules = null }) => {
  const portions = Math.max(0.5, adults + children * 0.5);
  const multi = lists.length > 1;
  const { meals, items } = ingredientRows(lists, portions, stock, rules);
  const keys = new Set(items.map((i) => keyOf(itemName(i.base))));
  const extra = provisions.map(withoutYouTube).filter((p) => p && !keys.has(keyOf(p)));
  const people = `${adults} ${adults === 1 ? "adult" : "adults"}${children ? ` and ${children} ${children === 1 ? "child" : "children"}` : ""}`;
  const row = (mpa, checked = false) => ({ label: mpaLabel(mpa), checked, indent: true, mpa });
  const onBoard = (areas = [], subs = []) => ({ ...(areas.length ? { areas } : {}), ...(subs.length ? { subs } : {}) });
  const ingredientRowsOut = items.map((i) => ({ name: itemName(i.base), item: row({ base: i.base, src: multi ? i.src : [], meals: i.meals, ...onBoard(i.areas, i.subs) }, i.checked) }));
  const provRows = extra.map((p) => ({ name: p, item: row({ base: amounts[p] ? `${p} – ${amounts[p]}` : p, prov: true, ...onBoard(stock[keyOf(p)]?.areas, subsFor(keyOf(p), p, stock, rules)) }, /^none needed/i.test(amounts[p] || "")) }));
  const mealKey = [{ label: `Meals (${meals.length}) from ${lists.map((l) => l.name).join(", ")}`, checked: false }, ...meals.map((m) => row({ base: m.name, src: multi ? [m.src] : [], meals: [m.n] }))];
  if (aisleOf) {
    const byAisle = new Map(aisleOrder.map((a) => [a, []]));
    [...ingredientRowsOut, ...provRows].forEach((r) => { const a = aisleOf(r.name); byAisle.set(a, [...(byAisle.get(a) || []), r.item]); });
    return [...mealKey, ...[...byAisle.entries()].filter(([, rs]) => rs.length).flatMap(([a, rs]) => [{ label: a, checked: false }, ...rs])];
  }
  return [
    ...mealKey,
    { label: `Ingredients for ${people}`, checked: false },
    ...ingredientRowsOut.map((r) => r.item),
    ...(provRows.length ? [{ label: `Provisions for ${days} ${days === 1 ? "day" : "days"}`, checked: false }, ...provRows.map((r) => r.item)] : []),
  ];
};
