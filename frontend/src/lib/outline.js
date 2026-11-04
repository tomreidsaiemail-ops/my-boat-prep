// Outline up to 4 levels: `indent` marks every sub-item (so one-level code keeps working) and `level` (2-3) marks deeper ones.
export const MAX_DEPTH = 3;
const rawDepth = (it) => (!it.indent ? 0 : Math.min(Math.max(Number(it.level) || 1, 1), MAX_DEPTH));
// Depths as shown: the first item is top level and no item sits more than one level below the item above it.
export const depthsOf = (items) => {
  const d = [];
  items.forEach((it, i) => { d.push(i === 0 ? 0 : Math.min(rawDepth(it), d[i - 1] + 1)); });
  return d;
};
const withDepth = (it, d) => {
  const { level: _l, ...rest } = it;
  return { ...rest, indent: d > 0, ...(d > 1 ? { level: d } : {}) };
};
const subtreeEnd = (d, i) => { let e = i + 1; while (e < d.length && d[e] > d[i]) e += 1; return e; };
const prevSibling = (d, i) => { for (let j = i - 1; j >= 0; j -= 1) { if (d[j] === d[i]) return j; if (d[j] < d[i]) return -1; } return -1; };
const nextSibling = (d, i) => { const e = subtreeEnd(d, i); return e < d.length && d[e] === d[i] ? e : -1; };
const siblingsOf = (d, i) => {
  let first = i;
  for (let j = prevSibling(d, i); j >= 0; j = prevSibling(d, j)) first = j;
  const out = [];
  for (let j = first; j >= 0; j = nextSibling(d, j)) out.push(j);
  return out;
};
// Rebuilds the list after reordering sibling subtrees (blocks of [start, end) indexes).
const reorderSiblings = (items, d, i, order) => {
  const sibs = siblingsOf(d, i);
  const blocks = sibs.map((s) => items.slice(s, subtreeEnd(d, s)));
  const start = sibs[0];
  const end = subtreeEnd(d, sibs[sibs.length - 1]);
  return [...items.slice(0, start), ...order(blocks, sibs.indexOf(i)).flat(), ...items.slice(end)];
};

// Per item: 6 / 6.1 / 6.1.1 number, depth, direct parent and ancestors (for folding), move limits, whole-subtree sub-item counts.
export const outlineInfo = (items) => {
  const d = depthsOf(items);
  const out = {};
  const path = [];
  const stack = [];
  items.forEach((it, i) => {
    path.length = d[i] + 1;
    path[d[i]] = (path[d[i]] || 0) + 1;
    stack.length = d[i];
    const end = subtreeEnd(d, i);
    const below = items.slice(i + 1, end);
    const sibs = siblingsOf(d, i);
    const k = sibs.indexOf(i);
    const prev = prevSibling(d, i);
    const deepest = Math.max(d[i], ...d.slice(i + 1, end));
    out[it.id] = {
      num: path.slice(0, d[i] + 1).join("."), pos: k + 1, total: sibs.length, child: d[i] > 0, depth: d[i],
      upOk: k > 0, downOk: k < sibs.length - 1, prevSib: prev >= 0 ? items[prev].id : null,
      canIndent: prev >= 0 && deepest < MAX_DEPTH && !items[prev].folder && !it.folder, canOutdent: d[i] > 0,
      shade: d[i] === 0 ? end - i > 1 : true,
      parent: d[i] ? stack[d[i] - 1] : it.id, ancestors: [...stack], top: d[i] ? stack[0] : it.id,
      subs: below.length, subsTicked: below.filter((x) => x.checked).length,
    };
    stack.push(it.id);
  });
  return out;
};

const at = (items, id) => items.findIndex((i) => i.id === id);

export const moveOutline = (items, id, dir) => {
  const i = at(items, id);
  if (i < 0) return items;
  const d = depthsOf(items);
  return reorderSiblings(items, d, i, (blocks, k) => {
    const j = k + dir;
    if (j < 0 || j >= blocks.length) return blocks;
    const b = [...blocks];
    [b[k], b[j]] = [b[j], b[k]];
    return b;
  });
};

// An item moves with everything under it to position n among the items at its own level.
export const placeOutline = (items, id, n) => {
  const i = at(items, id);
  if (i < 0) return items;
  const d = depthsOf(items);
  return reorderSiblings(items, d, i, (blocks, k) => {
    const b = [...blocks];
    const [it] = b.splice(k, 1);
    b.splice(Math.min(Math.max(n - 1, 0), b.length), 0, it);
    return b;
  });
};

// Flagging jumps an item (and everything under it) to the top of its level.
export const flagOutline = (items, id) => {
  const i = at(items, id);
  if (i < 0) return items;
  if (items[i].flagged) return items.map((x) => (x.id === id ? { ...x, flagged: false } : x));
  const d = depthsOf(items);
  const marked = items.map((x) => (x.id === id ? { ...x, flagged: true } : x));
  return reorderSiblings(marked, d, i, (blocks, k) => { const b = [...blocks]; const [f] = b.splice(k, 1); return [f, ...b]; });
};

// Indent right: the item and everything under it go one level in, under the item above at its level. Outdent left: one level out.
export const setIndent = (items, id, indent) => {
  const i = at(items, id);
  if (i < 0) return items;
  const info = outlineInfo(items)[id];
  if (indent ? !info.canIndent : !info.canOutdent) return items;
  const d = depthsOf(items);
  const end = subtreeEnd(d, i);
  const step = indent ? 1 : -1;
  return items.map((x, k) => (k >= i && k < end ? withDepth(x, d[k] + step) : x));
};

// Levels an edit changed (id -> old indent/level), so Undo can put them back.
export const levelShifts = (before, after) => {
  const was = new Map(before.map((i) => [i.id, i]));
  return new Map(after.filter((i) => was.get(i.id) && (was.get(i.id).level !== i.level || !!was.get(i.id).indent !== !!i.indent))
    .map((i) => [i.id, { indent: was.get(i.id).indent, level: was.get(i.id).level }]));
};
export const restoreLevels = (list, shifts) => list.map((i) => {
  if (!shifts.has(i.id)) return i;
  const { level: _l, indent: _i, ...rest } = i;
  const was = shifts.get(i.id);
  return { ...rest, ...(was.indent ? { indent: true } : {}), ...(was.level ? { level: was.level } : {}) };
});

// Re-levels items after a deletion so stored levels match what's shown (no item more than one level below the one above).
export const normalizeLevels = (items) => {
  const d = depthsOf(items);
  return items.map((x, k) => (rawDepth(x) !== d[k] || (d[k] === 0 && x.indent) ? withDepth(x, d[k]) : x));
};

// Deleting an item with sub-items promotes its first sub-item (and what's under that) one level so the rest stay grouped.
export const removeOutline = (items, id) => {
  const i = at(items, id);
  if (i < 0) return items;
  const d = depthsOf(items);
  const end = subtreeEnd(d, i);
  const firstEnd = i + 1 < end ? subtreeEnd(d, i + 1) : i + 1;
  return items.map((x, k) => (k > i && k < firstEnd ? withDepth(x, d[k] - 1) : x)).filter((x) => x.id !== id);
};

// "1. Trauma", "1.Trauma" and "1) Trauma" are headings; "2.5L water" isn't.
export const isHeadingLine = (label) => /^\d+[.)]\s*\p{L}/u.test(label);
export const ITEM_MAX = 1000;

// Pasted lines → items; with autoIndent, lines after a numbered heading become its sub-items.
export const linesToItems = (lines, autoIndent, base, max = ITEM_MAX) => {
  let inGroup = false;
  return lines.map((raw, i) => {
    const label = raw.slice(0, max);
    const heading = isHeadingLine(label);
    if (heading) inGroup = true;
    return { id: base + i, label, checked: false, ...(autoIndent && inGroup && !heading ? { indent: true } : {}) };
  });
};

// Items as Magic List Top-Up sees them: group headings are top-level items with sub-items, or numbered lines.
export const topUpOutline = (items, labelFor = (i) => i.label) => {
  const info = outlineInfo(items);
  return items.map((i) => ({ label: labelFor(i), heading: !info[i.id].child && (info[i.id].subs > 0 || isHeadingLine(i.label)) }));
};

// Ticked suggestions go to the end of their heading's group (indented), or to the end of the list.
export const insertSuggestions = (items, picks, base, labelFor = (i) => i.label) => {
  let next = [...items];
  picks.forEach((p, n) => {
    if (next.some((i) => labelFor(i).toLowerCase() === p.item.toLowerCase())) return;
    const item = { id: base + n, label: p.item, checked: false };
    const h = p.heading && next.findIndex((i, k) => !(k > 0 && i.indent) && labelFor(i).toLowerCase() === p.heading.toLowerCase());
    if (!p.heading || h < 0) { next = [...next, item]; return; }
    let end = h + 1;
    while (end < next.length && next[end].indent) end += 1;
    next = [...next.slice(0, end), { ...item, indent: true }, ...next.slice(end)];
  });
  return next;
};

// Leaving Dock: a "Departure" heading and the items under it tick together.
const isDepartureHead = (list, n) => n >= 0 && !list[n].indent && !!list[n + 1]?.indent && /\bdeparture\b/i.test(list[n].label || "");
const groupEnd = (list, n) => { let e = n + 1; while (e < list.length && list[e].indent) e += 1; return e; };
export const departureTicked = (list) => list.some((i, n) => i.checked && isDepartureHead(list, n));
export const tickDeparture = (list, id) => {
  const n = list.findIndex((i) => i.id === id);
  if (n < 0) return list;
  const on = !list[n].checked;
  if (isDepartureHead(list, n)) { const end = groupEnd(list, n); return list.map((i, k) => (k >= n && k < end ? { ...i, checked: on } : i)); }
  const next = list.map((i, k) => (k === n ? { ...i, checked: on } : i));
  if (!next[n].indent) return next;
  let h = n;
  while (h > 0 && next[h].indent) h -= 1;
  if (!isDepartureHead(next, h)) return next;
  const all = next.slice(h + 1, groupEnd(next, h)).every((i) => i.checked);
  return next.map((i, k) => (k === h ? { ...i, checked: all } : i));
};
