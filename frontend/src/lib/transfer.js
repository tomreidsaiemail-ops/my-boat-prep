// Transfer ownership: which cupboards the seller reviews, and the zone -> cupboard -> box tree for the final summary.
export const TRANSFER_LIST_ID = "transferOwnership";
export const TRANSFER_LIST_NAME = "Transfer ownership";

export const TRANSFER_RULES = [
  ["crew", "Crew registrations are not carried over."],
  ["prep", "Crew Prep lists for crew members are not carried over."],
  ["trips", "Previous trips, archived route plans and the current Trip Planning are not carried over."],
  ["log", "The Ship's Log is carried over in full, but every crew member mention is redacted with XXXXXXXXXX."],
  ["food", "All F and D (Food & Drink) cupboards are emptied automatically, even if they hold non-food items."],
  ["shore", "Your shore contacts and the watch rota are removed too."],
];

const live = (a) => (a.items || []).filter((i) => !i.removed);

export const isFood = (a, byId, seen = new Set()) => {
  if (a.food || a.drinks) return true;
  const p = byId[a.parent_id];
  return !!p && !seen.has(a.id) && isFood(p, byId, new Set([...seen, a.id]));
};

// Top cupboards in zone (rainbow) order, each followed by its boxes and folders.
const ordered = (areas, zones) => {
  const kids = (id) => areas.filter((a) => a.parent_id === id);
  const walk = (a, depth) => [{ area: a, depth }, ...kids(a.id).flatMap((k) => walk(k, depth + 1))];
  const tops = areas.filter((a) => !a.parent_id || !areas.some((p) => p.id === a.parent_id));
  const rank = (a) => (zones[a.id] ? zones[a.id].rank : 99);
  return [...tops].sort((x, y) => rank(x) - rank(y)).flatMap((a) => walk(a, 0));
};

export const wizardStops = (areas, zones) => {
  const byId = Object.fromEntries(areas.map((a) => [a.id, a]));
  return ordered(areas, zones).filter(({ area }) => live(area).length && !isFood(area, byId)).map(({ area }) => area.id);
};

// [{ zone, rows: [{ area, depth, food, items }] }] with the unzoned cupboards last.
export const zoneTree = (areas, zones) => {
  const byId = Object.fromEntries(areas.map((a) => [a.id, a]));
  const groups = new Map();
  ordered(areas, zones).forEach(({ area, depth }) => {
    const z = zones[area.id];
    const key = z ? z.map || z.colour : "";
    if (!groups.has(key)) groups.set(key, { zone: z ? z.map || "Zone" : "No zone", hex: z?.hex || "#D9DEE5", rows: [] });
    groups.get(key).rows.push({ area, depth, food: isFood(area, byId), items: live(area) });
  });
  return [...groups.values()];
};

export const qtyText = (i) => (i.qty === undefined || i.qty === null || i.qty === "" || Number(i.qty) === 1 ? "" : ` ×${i.qty}`);
