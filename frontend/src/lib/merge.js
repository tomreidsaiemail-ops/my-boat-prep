// Merge Latest: compares the master list with the skipper's list. With the master version the boat last synced (base),
// master changes are told apart from the skipper's own; without it, everything that differs is offered.
const key = (label) => String(label || "").replace(/^\s*\*\s*/, "").trim().toLowerCase().replace(/\s+/g, " ");
const keys = (items) => new Set((items || []).map((i) => key(i.label)));
const minus = (a, b) => a.filter((i) => !b.has(key(i.label)));

export const mergePlan = (base, master, local) => {
  const L = keys(local);
  const M = keys(master);
  if (!base) {
    return { exact: false, masterAdded: minus(master, L), masterRemoved: minus(local, M), mineAdded: [], mineRemoved: [],
      add: minus(master, L), remove: minus(local, M) };
  }
  const B = keys(base);
  const masterAdded = minus(master, B);
  const masterRemoved = minus(base, M);
  return {
    exact: true, masterAdded, masterRemoved, mineAdded: minus(local, B), mineRemoved: minus(base, L),
    add: masterAdded.filter((i) => !L.has(key(i.label))),
    remove: masterRemoved.filter((i) => L.has(key(i.label))),
  };
};

export const changeKey = (kind, item) => `${kind}:${key(item.label)}`;

// Keeps every local item (and its tick); takes only the master additions and removals the skipper picked.
export const applyMerge = (local, master, plan, picked) => {
  const drop = new Set(plan.remove.filter((i) => picked.has(changeKey("remove", i))).map((i) => key(i.label)));
  let out = local.filter((i) => !drop.has(key(i.label)));
  let next = Math.max(0, ...local.map((i) => Number(i.id) || 0)) + 1;
  const take = new Set(plan.add.filter((i) => picked.has(changeKey("add", i))).map((i) => key(i.label)));
  master.forEach((m, idx) => {
    if (!take.has(key(m.label))) return;
    let at = idx === 0 ? -1 : out.length - 1;
    for (let j = idx - 1; j >= 0; j -= 1) {
      const p = out.findIndex((o) => key(o.label) === key(master[j].label));
      if (p >= 0) { at = p; break; }
    }
    out = [...out.slice(0, at + 1), { ...m, id: next, checked: false }, ...out.slice(at + 1)];
    next += 1;
  });
  return out;
};
