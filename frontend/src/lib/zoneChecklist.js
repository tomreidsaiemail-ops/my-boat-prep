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

// What to make sure is in the photos of a zone; the galley list is the longest because it matters most.
export const zoneChecklist = (label) => (LISTS.find(([re]) => re.test(String(label || "").toLowerCase())) || [null, DEFAULT])[1];
