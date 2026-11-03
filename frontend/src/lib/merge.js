// Merge Latest: compares the master list with the skipper's list. With the master version the boat last synced (base),
// master changes are told apart from the skipper's own; without it, everything that differs is offered.
const norm = (label) => String(label || "").replace(/^\s*\*\s*/, "").trim().toLowerCase().replace(/\s+/g, " ");
// Indented items are keyed under their heading, so repeated sub-items (e.g. "Salt" under several meals) stay distinct.
const withKeys = (items) => {
  let parent = "";
  return (items || []).map((item) => {
    const n = norm(item.label);
    if (!item.indent) parent = n;
    return { ...item, mkey: item.indent ? `${parent} > ${n}` : n };
  });
};
const keySet = (items) => new Set(items.map((i) => i.mkey));
const minus = (a, b) => a.filter((i) => !b.has(i.mkey));

export const mergePlan = (rawBase, rawMaster, rawLocal) => {
  const local = withKeys(rawLocal);
  const master = withKeys(rawMaster);
  const L = keySet(local);
  const M = keySet(master);
  if (!rawBase) {
    return { exact: false, masterAdded: minus(master, L), masterRemoved: minus(local, M), mineAdded: [], mineRemoved: [],
      add: minus(master, L), remove: minus(local, M) };
  }
  const base = withKeys(rawBase);
  const B = keySet(base);
  const masterAdded = minus(master, B);
  const masterRemoved = minus(base, M);
  return {
    exact: true, masterAdded, masterRemoved, mineAdded: minus(local, B), mineRemoved: minus(base, L),
    add: masterAdded.filter((i) => !L.has(i.mkey)),
    remove: masterRemoved.filter((i) => L.has(i.mkey)),
  };
};

export const changeKey = (kind, item) => `${kind}:${item.mkey}`;

const strip = ({ mkey, ...item }) => item;

// Keeps every local item (and its tick); takes only the master additions and removals the skipper picked.
export const applyMerge = (rawLocal, rawMaster, plan, picked) => {
  const drop = new Set(plan.remove.filter((i) => picked.has(changeKey("remove", i))).map((i) => i.mkey));
  const take = new Set(plan.add.filter((i) => picked.has(changeKey("add", i))).map((i) => i.mkey));
  const master = withKeys(rawMaster);
  let out = withKeys(rawLocal).filter((i) => !drop.has(i.mkey));
  let next = Math.max(0, ...rawLocal.map((i) => Number(i.id) || 0)) + 1;
  master.forEach((m, idx) => {
    if (!take.has(m.mkey)) return;
    let at = idx === 0 ? -1 : out.length - 1;
    for (let j = idx - 1; j >= 0; j -= 1) {
      const p = out.findIndex((o) => o.mkey === master[j].mkey);
      if (p >= 0) { at = p; break; }
    }
    out = [...out.slice(0, at + 1), { ...m, id: next, checked: false }, ...out.slice(at + 1)];
    next += 1;
  });
  return out.map(strip);
};
