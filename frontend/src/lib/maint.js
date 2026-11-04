// Boat Maintenance lists (Deck Hardware, Sail Loft, Rigging, Ground Tackle) with typed attributes from the private admin lists
// "Admin - master attributes" (Name | type | lists) and "Admin - master attribute types" (type name - value, value...).
const normName = (s) => String(s || "").toLowerCase().replace(/[\u2018\u2019`]/g, "'").replace(/\s+/g, " ").trim();

export const MAINT_KIND = "maint";
export const MAINT_PREFIX = "Admin - master ";
export const MAINT_CATEGORY = "Boat Maintenance";
export const LAST_KEY = "last_service_date";
export const DUE_KEY = "next_service_date";
export const MAINT_LISTS = [
  { key: "deckHardware", name: "Deck Hardware" },
  { key: "sailLoft", name: "Sail Loft" },
  { key: "runningRigging", name: "Running Rigging" },
  { key: "standingRigging", name: "Standing Rigging" },
  { key: "groundTackle", name: "Ground Tackle" },
];
const BASIC = ["date", "integer", "integer age", "decimal", "decimal length", "decimal area", "decimal weight", "decimal cost", "image", "pdf"];
export const UNITS = { "decimal length": ["m", "mm", "feet", "inches"], "decimal area": ["sqm", "sq ft"], "decimal weight": ["g", "kg", "lb", "oz"] };

export const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
const isHead = (label) => /^\s*\d+\s*[.)]/.test(label);

export const parseTypes = (items = []) => Object.fromEntries(items.map((i) => String(i.label || "").match(/^\s*([^=:\u2013-]+?)\s*[=:\u2013-]\s*(.+)$/))
  .filter(Boolean).map(([, name, values]) => [normName(name), [...new Set(values.split(",").map((v) => v.trim()).filter(Boolean))]]));

const picklist = (name, lists) => {
  const n = normName(name).replace(/^picklist\s*:?\s*/, "");
  return lists[n] || lists[`${n}s`] || lists[n.replace(/s$/, "")] || null;
};
export const typeOf = (raw, lists) => {
  const t = normName(raw);
  const m = t.match(/^char\s*\(\s*(\d+)\s*\)$/);
  if (m) return { type: "char", max: Math.min(Number(m[1]) || 1000, 8000) };
  if (BASIC.includes(t)) return { type: t };
  const options = picklist(t, lists);
  return options ? { type: "picklist", options } : { type: "char", max: 1000 };
};

// Every "Name | type | lists" line; the lists part is "All" or comma separated list names.
export const parseAttributes = (items = [], typeItems = []) => {
  const lists = parseTypes(typeItems);
  return items.map((i) => String(i.label || "")).filter((l) => l.includes("|") && !isHead(l)).map((l) => {
    const [name, type = "char", where = "All"] = l.split("|").map((x) => x.trim());
    const on = normName(where) === "all" ? null : where.split(",").map(normName).filter(Boolean);
    return { key: slug(name), name, on, ...typeOf(type, lists) };
  }).filter((a) => a.key);
};

export const masterDefs = (adminLists) => {
  const find = (n) => adminLists.find((l) => normName(l.name) === n)?.items || [];
  return parseAttributes(find("admin - master attributes"), find("admin - master attribute types"));
};
const listName = (list) => normName(MAINT_LISTS.find((m) => m.key === list.maint)?.name || list.name);
export const attrsForList = (defs, list) => defs.filter((d) => !d.on || d.on.includes(listName(list)) || d.on.includes(normName(list.name)));

export const defaultUnit = (type, key, units) => {
  const imperial = units === "ft";
  if (type === "decimal length") return /diameter|thickness/.test(key) ? (imperial ? "inches" : "mm") : imperial ? "feet" : "m";
  if (type === "decimal area") return imperial ? "sq ft" : "sqm";
  if (type === "decimal weight") return imperial ? "lb" : "kg";
  return "";
};

export const localDate = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  try { return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T00:00:00`)); } catch { return iso; }
};

// A category's due date applies to each of its items unless the item has its own.
export const effectiveDue = (items, n) => {
  const own = items[n].attrs?.[DUE_KEY];
  if (own || !items[n].indent) return { date: own || "", inherited: false };
  let h = n;
  while (h > 0 && items[h].indent) h -= 1;
  return { date: items[h].attrs?.[DUE_KEY] || "", inherited: true };
};
export const dueTone = (iso, today = new Date()) => {
  if (!iso) return "";
  const days = (new Date(`${iso}T00:00:00`) - new Date(today.toDateString())) / 864e5;
  return days < 0 ? "red" : days <= 30 ? "orange" : "";
};

// Weight and cost the Magic Mariner estimates; they carry "<key>__est" until the skipper edits them.
export const ESTIMATED = ["decimal weight", "decimal cost"];
export const markEstimates = (groups, defs, units) => groups.map((g) => ({ ...g, items: g.items.map((i) => {
  const attrs = { ...i.attrs };
  defs.filter((d) => ESTIMATED.includes(d.type) && attrs[d.key]).forEach((d) => {
    const u = d.type === "decimal cost" ? units.cost : units.weight;
    if (u) attrs[`${d.key}__unit`] = u;
    attrs[`${d.key}__est`] = "1";
  });
  return { ...i, attrs };
}) }));
const pretty = (k) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const FILE_ID = /^[a-f0-9]{32}$/;
export const maintLabel = (item) => {
  const a = item.attrs || {};
  const parts = Object.entries(a).filter(([k, v]) => v && !k.endsWith("__unit") && !k.endsWith("__name") && !k.endsWith("__est") && !FILE_ID.test(v) && k !== LAST_KEY && k !== DUE_KEY)
    .map(([k, v]) => `${pretty(k)}: ${v}${a[`${k}__unit`] ? ` ${a[`${k}__unit`]}` : ""}${a[`${k}__est`] ? " (est.)" : ""}`);
  const due = a[DUE_KEY] || item.due_from;
  return [item.label, a[LAST_KEY] && `last serviced ${localDate(a[LAST_KEY])}`, due && `due ${localDate(due)}`, ...parts].filter(Boolean).join(" - ");
};
// For exports: items without their own date show their category's due date.
export const withInheritedDue = (data, registry) => ({ ...data, ...Object.fromEntries(registry.filter((l) => l.kind === MAINT_KIND).map((l) => {
  const items = data[l.id] || [];
  return [l.id, items.map((i, n) => { const d = effectiveDue(items, n); return d.inherited && d.date ? { ...i, due_from: d.date } : i; })];
})) });

const SAIL_WORDS = /\b(yacht|sloop|cutter|ketch|yawl|schooner|sail\w*|dinghy|catboat|catamaran|trimaran)\b/i;
export const looksLikeSailboat = (boat) => SAIL_WORDS.test(`${boat.boat_type || ""} ${boat.model || ""}`);
export const boatTitle = (boat) => [boat.make, boat.model, boat.boat_type].map((x) => (x || "").trim()).filter(Boolean).join(" ");
export const offerKey = (boatId, boat) => `${boatId}|${normName(boatTitle(boat))}`;

const G = (heading, ...items) => ({ heading, items: items.map((i) => (typeof i === "string" ? { label: i, attrs: {} } : i)) });
const A = (label, attrs) => ({ label, attrs });
export const STARTER = {
  deckHardware: [G("Winches", "Primary winch - port", "Primary winch - starboard", "Halyard winch", "Winch handles"),
    G("Blocks and tracks", "Mainsheet traveller", "Genoa cars and tracks", "Turning blocks"), G("Clutches and cleats", "Rope clutches", "Mooring cleats"),
    G("Deck fittings", "Stanchions and guardwires", "Pulpit and pushpit", "Hatches and portlights", "Windlass")],
  sailLoft: [G("Mainsail", A("Mainsail", { sail_type: "Main sail" })), G("Headsails", A("Genoa", { sail_type: "Genoa" }), A("Jib", { sail_type: "Jib" }), A("Storm jib", { sail_type: "Storm jib" })),
    G("Downwind", A("Spinnaker or gennaker", { sail_type: "Gennaker" })), G("Covers", "Sail cover or stack pack")],
  runningRigging: [G("Halyards", A("Main halyard", { line_type: "Halyard" }), A("Genoa halyard", { line_type: "Halyard" }), A("Spinnaker halyard", { line_type: "Halyard" })),
    G("Sheets", A("Mainsheet", { line_type: "Sheet" }), A("Genoa sheets", { line_type: "Sheet" }), A("Spinnaker sheets", { line_type: "Sheet" })),
    G("Control lines", A("Reef lines", { line_type: "Reef point" }), A("Outhaul", { line_type: "Outhaul" }), A("Kicker or vang", { line_type: "Kicker" }), "Furling line", A("Cunningham", { line_type: "Cunningham" })),
    G("Mooring lines", A("Bowlines", { line_type: "Bowline" }), A("Sternlines", { line_type: "Sternline" }), A("Springlines", { line_type: "Springline" }))],
  standingRigging: [G("Stays", A("Forestay", { line_type: "Forestay" }), A("Backstay", { line_type: "Backstay" })),
    G("Shrouds", A("Cap shrouds", { line_type: "Shroud" }), A("Lower shrouds", { line_type: "Shroud" })), G("Fittings", "Chainplates", "Turnbuckles and toggles", "Spreaders", "Mast step and masthead")],
  groundTackle: [G("Anchors", "Primary anchor", "Kedge anchor"), G("Rode", "Anchor chain", A("Anchor rope", { line_type: "Anchor rode" }), "Swivel and shackles"), G("Windlass", "Windlass and gypsy", "Chain stopper or snubber")],
};

// Headings carry the setup Service Due Date; their items inherit it until given their own.
export const maintItems = (groups, due, start = Date.now()) => {
  let n = 0;
  return groups.flatMap((g) => [
    { id: start + n++, label: g.heading, checked: false, maint: true, attrs: due ? { [DUE_KEY]: due } : {} },
    ...g.items.map((i) => ({ id: start + n++, label: i.label, checked: false, maint: true, indent: true, attrs: { ...i.attrs } })),
  ]);
};
