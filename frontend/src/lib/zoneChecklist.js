const LISTS = [
  [/galley|kitchen/, [
    "A wide shot of the whole galley first",
    "Every cupboard above the bench, doors open",
    "Every cupboard below the bench, doors open",
    "Every shelf, with its fiddles (the rails that stop things sliding off)",
    "Every drawer pulled out: cutlery, utensils, tools",
    "Under the sink and behind the stove",
    "Fridge and freezer with the lid open",
    "Lockers under the floor or seats near the galley",
    "The LPG shut-off valve and fire blanket",
  ]],
  [/cockpit|lazarette|deck|transom|swim/, [
    "A wide shot of the whole area first",
    "Every lazarette and locker with its lid open",
    "Lockers under the seats",
    "Winch handle pockets and binnacle storage",
    "Liferaft, lifebuoy and danbuoy positions",
  ]],
  [/saloon|lounge|chart|nav/, [
    "A wide shot of the whole saloon first",
    "Lockers behind and under the seats",
    "Every shelf with its fiddles",
    "Chart table and its drawers",
    "Under the floorboards: bilge, tanks, spares",
  ]],
  [/cabin|berth|bunk|stateroom|v-berth|forepeak/, [
    "A wide shot of the cabin first",
    "Hanging lockers with doors open",
    "Lockers under the bunk",
    "Shelves with their fiddles, and drawers",
  ]],
  [/head|bathroom|toilet|shower/, [
    "A wide shot of the heads first",
    "Cabinets and the space under the basin",
    "Seacocks and the holding tank valve",
  ]],
  [/engine/, [
    "A wide shot with the engine cover off",
    "Spares lockers and tool storage",
    "Filters, impeller and belts locations",
  ]],
  [/anchor|bow|foredeck/, [
    "The anchor locker with its lid open",
    "Windlass and its controls",
  ]],
];

const DEFAULT = [
  "A wide shot of the whole zone first",
  "Every cupboard and locker with doors open",
  "Every shelf with its fiddles, and every drawer",
  "Under the seats and floorboards",
];

// What to make sure is in the photos of a zone; the galley list is the longest because it matters most. Used until the admin list has loaded.
const builtIn = (label) => (LISTS.find(([re]) => re.test(String(label || "").toLowerCase())) || [null, DEFAULT])[1];

export const ZONE_CAPTURE = "Admin - Zone by Zone - Make sure you capture";
// "Admin - Zone by Zone - Make sure you capture": a zone name, then its bullets indented under it.
const byZone = (items = []) => items.reduce((acc, i) => (i.indent ? (acc.length ? [...acc.slice(0, -1), { ...acc[acc.length - 1], bullets: [...acc[acc.length - 1].bullets, i.label] }] : acc)
  : [...acc, { zone: i.label.trim().toLowerCase(), bullets: [] }]), []);
// The zone's own entry, else the longest zone name inside its label (Port Forward cabin -> Forward cabin; Aft Head -> Heads), else "Other zones".
export const zoneChecklist = (label, items) => {
  const zones = byZone(items).filter((z) => z.bullets.length);
  if (!zones.length) return builtIn(label);
  const l = String(label || "").trim().toLowerCase();
  const hit = zones.find((z) => z.zone === l)
    || [...zones].sort((a, b) => b.zone.length - a.zone.length).find((z) => l.includes(z.zone) || l.includes(z.zone.replace(/s$/, "")))
    || zones.find((z) => z.zone.startsWith("other"));
  return hit ? hit.bullets : builtIn(label);
};
