// One level of sub-items: a top-level item plus the indented items straight after it form a group.
const isChild = (items, i) => i > 0 && !!items[i].indent;

const groupsOf = (items) => {
  const gs = [];
  items.forEach((it, i) => { if (isChild(items, i)) gs[gs.length - 1].push(it); else gs.push([it]); });
  return gs;
};

const flat = (gs) => gs.flatMap((g) => g.map((it, k) => (k === 0 && it.indent ? { ...it, indent: false } : it)));

const locate = (items, id) => {
  const gs = groupsOf(items);
  for (let gi = 0; gi < gs.length; gi += 1) {
    const k = gs[gi].findIndex((x) => x.id === id);
    if (k >= 0) return { gs, gi, k };
  }
  return null;
};

// Per item: N / N.n number, whether it's a sub-item, move limits, and a shade on every group that has sub-items.
export const outlineInfo = (items) => {
  const gs = groupsOf(items);
  const out = {};
  gs.forEach((g, gi) => {
    g.forEach((it, k) => {
      out[it.id] = {
        num: k ? `${gi + 1}.${k}` : `${gi + 1}`, pos: k || gi + 1, total: k ? g.length - 1 : gs.length, child: k > 0,
        upOk: k ? k > 1 : gi > 0, downOk: k ? k < g.length - 1 : gi < gs.length - 1,
        canIndent: !k && gi > 0, shade: g.length > 1,
        parent: g[0].id, subs: k ? 0 : g.length - 1, subsTicked: k ? 0 : g.slice(1).filter((x) => x.checked).length,
      };
    });
  });
  return out;
};

export const moveOutline = (items, id, dir) => {
  const loc = locate(items, id);
  if (!loc) return items;
  const { gs, gi, k } = loc;
  if (!k) {
    const j = gi + dir;
    if (j < 0 || j >= gs.length) return items;
    [gs[gi], gs[j]] = [gs[j], gs[gi]];
    return flat(gs);
  }
  const g = [...gs[gi]];
  const j = k + dir;
  if (j < 1 || j >= g.length) return items;
  [g[k], g[j]] = [g[j], g[k]];
  gs[gi] = g;
  return flat(gs);
};

// Top-level items move with their sub-items to group position n; sub-items move to position n inside their group.
export const placeOutline = (items, id, n) => {
  const loc = locate(items, id);
  if (!loc) return items;
  const { gs, gi, k } = loc;
  if (!k) {
    const [g] = gs.splice(gi, 1);
    gs.splice(Math.min(Math.max(n - 1, 0), gs.length), 0, g);
    return flat(gs);
  }
  const g = [...gs[gi]];
  const [it] = g.splice(k, 1);
  g.splice(Math.min(Math.max(n, 1), g.length), 0, it);
  gs[gi] = g;
  return flat(gs);
};

// Flagging jumps an item (and its sub-items) to the top; a flagged sub-item jumps to the top of its group.
export const flagOutline = (items, id) => {
  const loc = locate(items, id);
  if (!loc) return items;
  const { gs, gi, k } = loc;
  const it = gs[gi][k];
  if (it.flagged) return items.map((i) => (i.id === id ? { ...i, flagged: false } : i));
  const g = gs[gi].map((x) => (x.id === id ? { ...x, flagged: true } : x));
  if (!k) { gs.splice(gi, 1); gs.unshift(g); return flat(gs); }
  const [f] = g.splice(k, 1);
  g.splice(1, 0, f);
  gs[gi] = g;
  return flat(gs);
};

export const setIndent = (items, id, indent) => items.map((i, n) => (i.id === id && (n > 0 || !indent) ? { ...i, indent } : i));

// Deleting a top-level item promotes its first sub-item so the rest stay grouped.
export const removeOutline = (items, id) => {
  const n = items.findIndex((i) => i.id === id);
  if (n < 0) return items;
  const next = items.map((i, x) => (x === n + 1 && !isChild(items, n) && i.indent ? { ...i, indent: false } : i));
  return next.filter((i) => i.id !== id);
};

export const isHeadingLine = (label) => /^\d+[.)]\s+\S/.test(label);
export const ITEM_MAX = 1000;

// Pasted lines → items; with autoIndent, lines after a numbered heading become its sub-items.
export const linesToItems = (lines, autoIndent, base) => {
  let inGroup = false;
  return lines.map((raw, i) => {
    const label = raw.slice(0, ITEM_MAX);
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
