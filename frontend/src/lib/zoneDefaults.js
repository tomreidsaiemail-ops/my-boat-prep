import { newAreaItemId } from "@/lib/inventoryMove";

// Cupboards made for a zone the first time the Magic Mariner finds it on a plan. F = food, D = drinks. The skipper can rename or remove any of them.
const F = { food: true };
const FD = { food: true, drinks: true };
export const ZONE_CUPBOARDS = {
  galley: [["Fridge", FD], ["Freezer", FD], ["Oven"], ["Pantry", F], ["Cutlery Drawer"], ["Crockery Cupboard"], ["Dry Food Locker", F], ["Pots and Pans Locker"], ["Hanging Basket", F]],
  cockpit: [["Port lazarette"], ["Starboard lazarette"], ["Gas Locker"], ["Technical Locker"]],
  "nav station": [["Nav Desk"], ["Bookshelf"], ["Instrument Panel"], ["Nav Locker"]],
  saloon: [["Settee locker fore"], ["Settee locker aft"]],
  "forward cabin": [["Berth drawer"]],
};

const key = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

export const usualCupboards = (label) => (ZONE_CUPBOARDS[key(label)] || []).map(([name]) => name);

// The usual cupboards for these zones: new ones are added, and a same-named cupboard not yet in any zone
// (zoned: ids already in one) is filed under it. Never doubles one up. count: cupboards added or filed.
export const withZoneDefaults = (swatches, areas, zoned = {}) => {
  const byName = new Map(areas.filter((a) => !a.parent_id).map((a) => [key(a.name), a]));
  const filed = {};
  const fresh = [];
  swatches.forEach((s) => (ZONE_CUPBOARDS[key(s.label)] || []).forEach(([name, flags = {}]) => {
    const zone = { label: s.label, colour: s.colour };
    const have = byName.get(key(name));
    if (!have) { const a = { id: newAreaItemId(), name, items: [], zone, ...flags }; byName.set(key(name), a); fresh.push(a); }
    else if (!have.zone && !zoned[have.id] && !filed[have.id]) filed[have.id] = zone;
  }));
  return { areas: [...areas.map((a) => (filed[a.id] ? { ...a, zone: filed[a.id] } : a)), ...fresh], count: fresh.length + Object.keys(filed).length };
};
