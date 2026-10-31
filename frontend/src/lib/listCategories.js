// List categories from the private admin list "Admin - List Categories": a heading, a "*Colour*" line, then list names.
import { DEFAULT_REGISTRY } from "@/lib/defaults";

const C = (bg, fg, shade) => ({ bg, fg, shade });
export const COLOURS = {
  brown: C("#8B5A34", "#FFFFFF", "#F7EFE8"),
  green: C("#2F7D3A", "#FFFFFF", "#EDF6EE"),
  blue: C("#1F5FAE", "#FFFFFF", "#ECF2FA"),
  red: C("#C0392B", "#FFFFFF", "#FBEDEB"),
  yellow: C("#F2C230", "#3A2E00", "#FFF8DF"),
  orange: C("#E07B24", "#FFFFFF", "#FDF1E6"),
  purple: C("#7B52BE", "#FFFFFF", "#F3EEFB"),
  pink: C("#D2427F", "#FFFFFF", "#FCEDF3"),
  teal: C("#0F8577", "#FFFFFF", "#E7F4F2"),
  grey: C("#6B7280", "#FFFFFF", "#F3F4F6"),
};
export const WHITE = C("#FFFFFF", "#0B1F3A", "#FFFFFF");
export const USER_PURPLE = C("#CDBBF2", "#2E1A5C", "#F5F0FD");

const COLOUR_LINE = /^\*\s*([a-z ]+?)\s*\*$/i;
export const normName = (s) => String(s || "").toLowerCase().replace(/[\u2018\u2019`]/g, "'").replace(/\s+/g, " ").trim();
const headText = (s) => s.replace(/^\s*\d+\s*[.)]\s*/, "").trim();

export const parseCategories = (items = []) => {
  const lines = items.map((i) => String(i.label || "").trim()).filter(Boolean);
  const out = [];
  lines.forEach((line, k) => {
    const c = line.match(COLOUR_LINE);
    if (c) { if (out.length) out[out.length - 1].colour = c[1].toLowerCase().replace("gray", "grey"); return; }
    if (COLOUR_LINE.test(lines[k + 1] || "")) out.push({ name: headText(line), colour: "", names: [] });
    else if (out.length) out[out.length - 1].names.push(normName(line));
  });
  return out.filter((c) => c.name).map((c) => ({ ...c, colours: COLOURS[c.colour] || COLOURS.grey }));
};

export const isUserList = (l) => !l.isSystem && !l.isShared && !l.isInventory && !l.isMedia;
const DEFAULT_NAMES = Object.fromEntries(DEFAULT_REGISTRY.map((l) => [l.id, normName(l.name)]));

// A user's own link ("category" on the list, "" = none) wins; otherwise the list's name (or built-in name) is looked up.
export const organiseLists = (lists, cats) => {
  const byName = new Map();
  cats.forEach((c, ci) => c.names.forEach((n, ni) => { if (!byName.has(n)) byName.set(n, [ci, ni]); }));
  const catIdx = new Map(cats.map((c, i) => [normName(c.name), i]));
  const placed = lists.map((l, order) => {
    const user = isUserList(l);
    const linked = user && typeof l.category === "string";
    const hit = linked ? (catIdx.has(normName(l.category)) ? [catIdx.get(normName(l.category)), 1e6 + order] : null)
      : byName.get(normName(l.name)) || byName.get(DEFAULT_NAMES[l.id]);
    const cat = hit ? hit[0] : -1;
    return { list: l, user, cat, rank: hit ? hit[1] : order, colours: cat >= 0 ? cats[cat].colours : user ? USER_PURPLE : WHITE };
  });
  return {
    groups: cats.map((c, i) => ({ name: c.name, colours: c.colours, rows: placed.filter((p) => p.cat === i).sort((a, b) => a.rank - b.rank) })),
    loose: placed.filter((p) => p.cat < 0 && !p.user),
    mine: placed.filter((p) => p.cat < 0 && p.user),
    byId: Object.fromEntries(placed.map((p) => [p.list.id, p])),
  };
};

// Dropdown sections: Boat Inventory first, then each category, then uncategorised (white), then the user's own uncategorised (purple).
export const dropdownSections = (org, firstId, hidden, activeId) => {
  const visible = (p) => !hidden.includes(p.list.id) || p.list.id === activeId;
  const show = (p) => p.list.id !== firstId && visible(p);
  const first = org.byId[firstId];
  return [
    ...(first && visible(first) ? [{ key: "first", label: "", rows: [first] }] : []),
    ...org.groups.map((g) => ({ key: `cat-${g.name}`, label: g.name, colours: g.colours, rows: g.rows.filter(show) })),
    { key: "loose", label: "", rows: org.loose.filter(show) },
    { key: "mine", label: "Your lists", kind: "mine", colours: USER_PURPLE, rows: org.mine.filter(show) },
  ].filter((s) => s.rows.length);
};
