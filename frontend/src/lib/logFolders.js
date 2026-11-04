// Ship's Log folders: passage folders (Source - Destination - Date range) and year folders ("2024 Ship's Logs").
// A log or folder belongs to a folder through `in`; folders keep `open` so they sync like any other log row.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isStamp = (id) => typeof id === "number" && id > 1e12 && id < 1e13;
const iso = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const entryDate = (item) => (item.folder ? item.from || "" : DAY.test(item.log_date || "") ? item.log_date : isStamp(item.id) ? iso(item.id) : "");
export const niceDate = (d) => (DAY.test(d || "") ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
export const rangeText = (from, to) => (from && to && from !== to ? `${niceDate(from)} to ${niceDate(to)}` : niceDate(from || to));
export const passageName = (src, dst, from, to) => [src.trim() || "?", dst.trim() || "?", rangeText(from, to)].filter(Boolean).join(" - ");

const parentOf = (byId, i) => (i.in && byId.get(i.in)?.folder && i.in !== i.id ? i.in : null);
export const topLevel = (items) => { const byId = new Map(items.map((i) => [i.id, i])); return items.filter((i) => !parentOf(byId, i)); };

// Display order: each folder is followed by its contents; contents of closed folders are hidden.
export const arrangeLog = (items) => {
  const byId = new Map(items.map((i) => [i.id, i]));
  const kids = new Map();
  items.forEach((i) => { const p = parentOf(byId, i); if (p) kids.set(p, [...(kids.get(p) || []), i]); });
  const out = [];
  const seen = new Set();
  const walk = (i, depth, hidden) => {
    if (seen.has(i.id)) return;
    seen.add(i.id);
    out.push({ item: i, depth, hidden });
    if (i.folder) (kids.get(i.id) || []).forEach((k) => walk(k, depth + 1, hidden || !i.open));
  };
  items.filter((i) => !parentOf(byId, i)).forEach((i) => walk(i, 0, false));
  const counts = Object.fromEntries([...kids].map(([id, ks]) => [id, ks.length]));
  return { rows: out, counts };
};

const withFolder = (items, members, folder) => {
  const ids = new Set(members.map((m) => m.id));
  const at = items.findIndex((i) => ids.has(i.id));
  const next = items.map((i) => (ids.has(i.id) ? { ...i, in: folder.id } : i));
  return [...next.slice(0, at), folder, ...next.slice(at)];
};

export const groupPassage = (items, startId, endId, { src, dst, from, to }) => {
  const tops = topLevel(items);
  let a = tops.findIndex((i) => i.id === startId);
  let b = tops.findIndex((i) => i.id === endId);
  if (a < 0 || b < 0) return null;
  if (a > b) [a, b] = [b, a];
  const members = tops.slice(a, b + 1).filter((i) => i.folder !== "year");
  if (!members.length) return null;
  const folder = { id: Date.now(), label: passageName(src, dst, from, to), folder: "passage", src: src.trim(), dst: dst.trim(), from, to, open: false, checked: false };
  return withFolder(items, members, folder);
};

export const logYears = (items) => [...new Set(topLevel(items).filter((i) => i.folder !== "year").map((i) => entryDate(i).slice(0, 4)).filter(Boolean))].sort().reverse();
export const yearMembers = (items, year) => topLevel(items).filter((i) => i.folder !== "year" && entryDate(i).startsWith(year));

export const foldYear = (items, year) => {
  const members = yearMembers(items, year);
  if (!members.length) return null;
  const existing = items.find((i) => i.folder === "year" && i.year === year);
  if (existing) return items.map((i) => (members.some((m) => m.id === i.id) ? { ...i, in: existing.id } : i.id === existing.id ? { ...i, open: false } : i));
  return withFolder(items, members, { id: Date.now(), label: `${year} Ship's Logs`, folder: "year", year, from: `${year}-01-01`, open: false, checked: false });
};

export const ungroup = (items, folderId) => {
  const f = items.find((i) => i.id === folderId);
  return items.filter((i) => i.id !== folderId).map((i) => (i.in === folderId ? (f?.in ? { ...i, in: f.in } : (({ in: _x, ...rest }) => rest)(i)) : i));
};

export const setAllOpen = (items, open) => items.map((i) => (i.folder ? { ...i, open } : i));
