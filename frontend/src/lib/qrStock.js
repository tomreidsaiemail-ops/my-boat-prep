// Cupboard contents changes from a QR card scan: add, replace or take out (used), plus the quick count afterwards.
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const qtyOf = (i) => (i.qty === undefined || i.qty === null || i.qty === "" ? 1 : Number(i.qty) || 0);

export const applyQr = (items = [], list, mode) => {
  if (mode === "replace") return list.map((i) => ({ id: newId(), name: i.name.trim(), qty: i.qty }));
  const next = [...items];
  if (mode === "out") {
    return next.map((i) => {
      const u = list.find((l) => l.itemId === i.id);
      if (!u) return i;
      const left = Math.max(0, qtyOf(i) - u.qty);
      return left ? { ...i, qty: left } : { ...i, qty: 0, removed: true };
    });
  }
  list.forEach((f) => {
    const at = next.findIndex((y) => same(y.name, f.name));
    if (at >= 0) next[at] = { ...next[at], qty: (next[at].removed ? 0 : qtyOf(next[at])) + f.qty, removed: false };
    else next.push({ id: newId(), name: f.name.trim(), qty: f.qty });
  });
  return next;
};

// Low stock: down to 1, or none left (removed for now / 0).
export const quickCount = (items = []) => {
  const inPlace = items.filter((i) => !i.removed && qtyOf(i) > 0);
  return {
    total: inPlace.reduce((n, i) => n + qtyOf(i), 0),
    lines: inPlace.length,
    low: items.filter((i) => i.removed || qtyOf(i) <= 1).map((i) => ({ id: i.id, name: i.name, left: i.removed ? 0 : qtyOf(i) })),
  };
};

// Matches a Magic Scan name to a cupboard item: exact first, then either name containing the other.
export const matchItem = (items, name) => {
  const n = name.trim().toLowerCase();
  return items.find((i) => i.name.trim().toLowerCase() === n)
    || items.find((i) => { const m = i.name.trim().toLowerCase(); return m.includes(n) || n.includes(m); });
};
