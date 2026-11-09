import { newAreaItemId } from "@/lib/inventoryMove";

// Cupboards made for a zone the first time the Magic Mariner finds it on a plan. F = food, D = drinks. The skipper can rename or remove any of them.
const F = { food: true };
const FD = { food: true, drinks: true };
export const ZONE_CUPBOARDS = {
  galley: [["Fridge", FD], ["Freezer", FD], ["Oven"], ["Pantry", F], ["Cutlery Drawer"], ["Dry Food Locker", F], ["Pots and Pans Locker"], ["Hanging Basket", F]],
  cockpit: [["Port lazarette"], ["Starboard lazarette"], ["Gas Locker"], ["Technical Locker"]],
  "nav station": [["Nav Desk"], ["Bookshelf"], ["Instrument Panel"], ["Nav Locker"]],
  saloon: [["Settee locker fore"], ["Settee locker aft"]],
  "forward cabin": [["Berth drawer"]],
};

const key = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

// New cupboards for the placed zone colours, skipping any name the boat already has.
export const zoneDefaultAreas = (swatches, areas) => {
  const have = new Set(areas.filter((a) => !a.parent_id).map((a) => key(a.name)));
  return swatches.flatMap((s) => (ZONE_CUPBOARDS[key(s.label)] || [])
    .filter(([name]) => !have.has(key(name)) && have.add(key(name)))
    .map(([name, flags = {}]) => ({ id: newAreaItemId(), name, items: [], zone: { label: s.label, colour: s.colour }, ...flags })));
};
