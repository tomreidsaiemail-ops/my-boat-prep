// Shopping in, food and drink out: Batch Magic Scan My Shopping and Sync Food & Drink Boat Areas Magically.
import { newAreaItemId } from "@/lib/inventoryMove";

export const SHOP_MAX = 20;
export const SHOP_DEFAULTS = [
  { name: "Fridge", food: true, drinks: true }, { name: "Freezer", food: true }, { name: "Dry Goods", food: true }, { name: "Hanging Basket", food: true },
  { name: "Pantry", food: true }, { name: "Bilge", drinks: true }, { name: "Gantry", drinks: true },
];
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
export const itemKey = norm;

// Suggested areas first (existing or to be created), then any other area already flagged F or D.
export const shopTargets = (areas) => {
  const tops = areas.filter((a) => !a.parent_id);
  const out = SHOP_DEFAULTS.map((d) => {
    const a = tops.find((x) => norm(x.name) === norm(d.name));
    return a ? { id: a.id, name: a.name, food: !!(a.food || d.food), drinks: !!(a.drinks || d.drinks), use: true, isNew: false }
      : { id: newAreaItemId(), name: d.name, food: !!d.food, drinks: !!d.drinks, use: true, isNew: true };
  });
  tops.filter((a) => (a.food || a.drinks) && !out.some((o) => o.id === a.id)).forEach((a) => out.push({ id: a.id, name: a.name, food: !!a.food, drinks: !!a.drinks, use: true, isNew: false }));
  return out;
};

// Creates the chosen new areas and saves the F/D flags of every chosen area.
export const applyTargets = (areas, targets) => {
  const used = targets.filter((t) => t.use && (t.food || t.drinks));
  const next = areas.map((a) => { const t = used.find((u) => u.id === a.id); return t ? { ...a, food: t.food, drinks: t.drinks } : a; });
  used.filter((t) => t.isNew && !next.some((a) => a.id === t.id)).forEach((t) => next.push({ id: t.id, name: t.name, items: [], food: t.food, drinks: t.drinks }));
  return next;
};

export const learnedArea = (areas, name) => areas.find((a) => (a.learned || []).includes(itemKey(name)))?.id || null;

// rows: [{ name, qty, dest, setArea }]. Same-name items add to the quantity; moved items are remembered on their new area.
export const applyShopping = (areas, rows) => {
  const next = areas.map((a) => ({ ...a, items: [...(a.items || [])], learned: [...(a.learned || [])] }));
  const moved = new Set(rows.filter((r) => r.dest !== r.setArea).map((r) => itemKey(r.name)));
  rows.forEach((r) => {
    const key = itemKey(r.name);
    const dest = next.find((a) => a.id === r.dest);
    if (!dest) return;
    const at = dest.items.findIndex((i) => norm(i.name) === key);
    const unit = r.weight > 0 && r.qty > 0 ? { unit_g: Math.round((r.weight / r.qty) * 10) / 10 } : {};
    if (at >= 0) dest.items[at] = { ...dest.items[at], qty: (Number(dest.items[at].qty) || 0) + r.qty, removed: false, ...unit };
    else dest.items.push({ id: newAreaItemId(), name: r.name, qty: r.qty, ...unit });
    if (r.dest === r.setArea && moved.has(key)) return;
    next.forEach((a) => { a.learned = a.learned.filter((k) => k !== key); });
    if (r.dest !== r.setArea) dest.learned = [...dest.learned, key].slice(-300);
  });
  return next.map(({ learned, ...a }) => (learned.length ? { ...a, learned } : a));
};

// Everything on board in Food/Drink areas (and their folders/boxes).
export const stockOf = (areas) => {
  const fd = new Set(areas.filter((a) => a.food || a.drinks).map((a) => a.id));
  const name = (a) => { const p = a.parent_id && areas.find((x) => x.id === a.parent_id); return p ? `${p.name} > ${a.name}` : a.name; };
  return areas.filter((a) => fd.has(a.id) || fd.has(a.parent_id)).flatMap((a) => (a.items || [])
    .filter((i) => !i.removed && Number(i.qty) >= 1).map((i) => ({ areaId: a.id, itemId: i.id, name: i.name, qty: Number(i.qty), area: name(a) })));
};

// used: [{ areaId, itemId, qty }]. Items reaching 0 stay listed, ticked "removed for now", so they show up for restocking.
export const applyConsumed = (areas, used) => areas.map((a) => {
  const mine = used.filter((u) => u.areaId === a.id);
  if (!mine.length) return a;
  return { ...a, items: (a.items || []).map((i) => {
    const u = mine.find((m) => m.itemId === i.id);
    if (!u) return i;
    const left = Math.max(0, (Number(i.qty) || 0) - u.qty);
    return left ? { ...i, qty: left } : { ...i, qty: 0, removed: true };
  }) };
});

export const fmtWeight = (g, units) => {
  if (units === "ft") return `${(g / 453.592).toFixed(1)} lb`;
  return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`;
};
const when = () => new Date().toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const byArea = (rows, nameOf) => {
  const sums = {};
  rows.forEach((r) => { const n = nameOf(r); sums[n] = (sums[n] || 0) + r.qty; });
  return Object.entries(sums).map(([n, q]) => `${n} ${q}`).join(", ");
};
const total = (rows) => rows.reduce((n, r) => n + r.qty, 0);
const grams = (rows) => rows.reduce((n, r) => n + (r.weight || 0), 0);
export const shopLog = (rows, nameOf, units) =>
  `Batch Magic Scan My Shopping, ${when()}: ${total(rows)} ${total(rows) === 1 ? "item" : "items"} added, MPA estimated weight added ${fmtWeight(grams(rows), units)} (${byArea(rows, nameOf)})`;
export const usedLog = (rows, nameOf, units) =>
  `Sync Food & Drink Boat Areas Magically, ${when()}: ${total(rows)} ${total(rows) === 1 ? "item" : "items"} removed, MPA estimated weight removed ${fmtWeight(grams(rows), units)} (${byArea(rows, nameOf)})`;
