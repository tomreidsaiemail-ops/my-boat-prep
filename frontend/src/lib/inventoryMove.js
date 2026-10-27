export const newAreaItemId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Moves picked cupboard items (whole or part quantities) and tagged checklist items out of one boat area.
// Same-name items in the target area get the moved quantity added on.
export const applyMove = (s, { sourceId, order, moves, links }) => {
  const areas = (s.areas || []).map((a) => ({ ...a, items: [...(a.items || [])] }));
  const src = areas.find((a) => a.id === sourceId);
  if (!src) return s;
  const pos = new Map(order.map((id, i) => [id, i]));
  src.items.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  moves.forEach(({ id, qty, target }) => {
    const dest = areas.find((a) => a.id === target);
    const at = src.items.findIndex((x) => x.id === id);
    if (!dest || dest === src || at < 0) return;
    const item = src.items[at];
    const have = item.qty || 1;
    const n = Math.min(qty, have);
    if (n >= have) src.items.splice(at, 1); else src.items[at] = { ...item, qty: have - n };
    const match = dest.items.findIndex((x) => same(x.name, item.name));
    if (match >= 0) {
      const m = dest.items[match];
      dest.items[match] = { ...m, qty: Math.min(9999, (m.qty || 1) + n), removed: !!(m.removed || item.removed) };
    } else dest.items.push({ ...item, id: n >= have ? item.id : newAreaItemId(), qty: n });
  });
  const data = { ...s.data };
  links.forEach(({ listId, itemId, target }) => {
    if (data[listId]) data[listId] = data[listId].map((i) => (i.id === itemId ? { ...i, area: target } : i));
  });
  return { ...s, areas, data };
};
