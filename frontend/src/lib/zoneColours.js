export const ZONE_COLOURS = {
  Gold: "#D4A017", Blue: "#1E63D6", Green: "#2E9D4A", Yellow: "#F2D33C", Orange: "#F28C28", Purple: "#7E3FBF", Pink: "#F06EAA",
  Brown: "#8B5A2B", Gray: "#8A8F98", Teal: "#14857F", Maroon: "#800020", Navy: "#1B2A6B", Turquoise: "#30C5D2", Lavender: "#B69DE0",
  Magenta: "#D0219F", Lime: "#9BD13B", Coral: "#FF7F66", Olive: "#7A7A2A", Beige: "#E3D3AE", Red: "#D62828",
  "Light Red": "#F07070", "Lime Green": "#32CD32", Copper: "#B87333", Emerald: "#10A060", Peach: "#FFC59E", Mint: "#98E2C0", Tan: "#D2B48C",
  Sepia: "#704214", Chartreuse: "#B8E000", "Sky Blue": "#7CC4F0", Crimson: "#B0102C", Plum: "#8E4585", Amber: "#FFB300", Violet: "#8F00FF",
  Salmon: "#FA8072", Silver: "#B8BEC6", Indigo: "#3F2A9E", Aqua: "#00C7C7", Khaki: "#C3B091", Rust: "#B7410E", Mustard: "#D8A31A",
  Cream: "#F3E9C6", Charcoal: "#36454F", Rose: "#E8507A", Jade: "#00A86B", Cobalt: "#0047AB", Lilac: "#C8A2C8", Burgundy: "#6D1A36",
  Ochre: "#CC7722", Slate: "#6A7B8C",
  Scarlet: "#FF2400", Cherry: "#C2185B", Ruby: "#9B111E", Wine: "#722F37", Raspberry: "#E30B5C", Fuchsia: "#FF00C8", "Hot Pink": "#FF69B4",
  Blush: "#F4B6C2", Apricot: "#FBCEB1", Tangerine: "#FF9408", Pumpkin: "#FF7518", Terracotta: "#E2725B", Cinnamon: "#A0522D", Chocolate: "#5C3317",
  Mocha: "#967259", Caramel: "#C68E17", Honey: "#EBA937", Sand: "#D8C29D", Ivory: "#FFFBEA", Lemon: "#FFF44F", Butter: "#FFE680",
  Pistachio: "#93C572", Sage: "#9CAF88", Moss: "#8A9A5B", "Forest Green": "#228B22", Pine: "#01796F", Seafoam: "#71EEB8", "Kelly Green": "#4CBB17",
  Cyan: "#00E5FF", "Ice Blue": "#C6E6FB", "Baby Blue": "#A1CAF1", "Powder Blue": "#B0E0E6", "Steel Blue": "#4682B4", Denim: "#1560BD",
  "Royal Blue": "#4169E1", Sapphire: "#0F52BA", Midnight: "#191970", Ocean: "#006994", Periwinkle: "#8C9EFF", Iris: "#5A4FCF", Amethyst: "#9966CC",
  Orchid: "#DA70D6", Mauve: "#B784A7", Grape: "#6F2DA8", Eggplant: "#614051", Taupe: "#8B8589", Pewter: "#96A8A1", Graphite: "#474A51",
  Black: "#111111", White: "#FFFFFF",
};
export const PALETTE = Object.keys(ZONE_COLOURS);
export const RAINBOW = ["Red", "Scarlet", "Crimson", "Cherry", "Ruby", "Light Red", "Raspberry", "Rose", "Maroon", "Burgundy", "Wine", "Coral", "Salmon", "Terracotta", "Peach", "Apricot",
  "Orange", "Tangerine", "Pumpkin", "Rust", "Copper", "Cinnamon", "Ochre", "Brown", "Chocolate", "Sepia", "Mocha", "Caramel", "Tan", "Khaki", "Sand", "Taupe",
  "Gold", "Honey", "Amber", "Mustard", "Beige", "Cream", "Ivory", "Butter", "Lemon", "Yellow", "Chartreuse", "Olive", "Moss", "Pistachio", "Sage", "Lime", "Lime Green", "Kelly Green",
  "Green", "Forest Green", "Emerald", "Jade", "Pine", "Seafoam", "Mint", "Teal", "Aqua", "Cyan", "Turquoise", "Ocean", "Ice Blue", "Powder Blue", "Baby Blue", "Sky Blue",
  "Steel Blue", "Denim", "Blue", "Royal Blue", "Cobalt", "Sapphire", "Navy", "Midnight", "Periwinkle", "Iris", "Indigo", "Violet", "Amethyst", "Lavender", "Lilac", "Orchid",
  "Mauve", "Purple", "Grape", "Plum", "Eggplant", "Magenta", "Fuchsia", "Hot Pink", "Pink", "Blush", "White", "Silver", "Pewter", "Gray", "Slate", "Graphite", "Charcoal", "Black"];
// Light colours need dark writing on them.
export const LIGHT = new Set(["Yellow", "Beige", "Lime", "Turquoise", "Lavender", "Gold", "Peach", "Mint", "Tan", "Chartreuse", "Sky Blue", "Amber", "Salmon", "Silver",
  "Aqua", "Khaki", "Cream", "Lilac", "Mustard", "Lime Green", "Coral", "Light Red", "Blush", "Apricot", "Tangerine", "Honey", "Sand", "Ivory", "Lemon", "Butter",
  "Pistachio", "Sage", "Seafoam", "Kelly Green", "Cyan", "Ice Blue", "Baby Blue", "Powder Blue", "Periwinkle", "Orchid", "Mauve", "Pewter", "White", "Hot Pink", "Caramel",
  "Orange", "Pumpkin", "Pink"]);
const ALIASES = { grey: "gray", oilve: "olive", lightred: "light red", limegreen: "lime green", skyblue: "sky blue", "light grey": "gray", "light gray": "silver" };
export const colourName = (v) => {
  const low = String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
  const want = ALIASES[low] || low;
  return PALETTE.find((c) => c.toLowerCase() === want) || null;
};

export const mapLabel = (m, n) => m.name || `Zone map ${n + 1}`;

// Area id -> the colour and name of the zone map it's pinned on; folders and boxes take their cupboard's.
export const areaZones = (boat, areas) => {
  const out = {};
  // A zone picked for the cupboard itself wins over a pin on a Zone Map Photo.
  areas.forEach((a) => {
    const z = a.zone;
    if (z && ZONE_COLOURS[z.colour]) out[a.id] = { colour: z.colour, hex: ZONE_COLOURS[z.colour], map: z.label, rank: RAINBOW.indexOf(z.colour) };
  });
  (boat?.zone_maps || []).forEach((m, n) => (m.pins || []).forEach((p) => {
    if (p.area_id && !out[p.area_id] && ZONE_COLOURS[m.colour]) out[p.area_id] = { colour: m.colour, hex: ZONE_COLOURS[m.colour], map: m.zone || mapLabel(m, n), rank: RAINBOW.indexOf(m.colour) };
  }));
  areas.forEach((a) => { if (a.parent_id && out[a.parent_id]) out[a.id] = out[a.parent_id]; });
  return out;
};

// Rainbow order, same colours together, areas not on a zone map last; within a colour the skipper's order is kept.
export const rainbowGroups = (rows, zones) => {
  const groups = new Map();
  rows.forEach((r) => {
    const z = zones[r.area.id];
    const key = z ? z.colour : "";
    if (!groups.has(key)) groups.set(key, { key, zone: z || null, rows: [] });
    groups.get(key).rows.push(r);
  });
  return [...groups.values()].sort((x, y) => (x.zone ? x.zone.rank : 99) - (y.zone ? y.zone.rank : 99));
};

const low = (v) => String(v || "").trim().toLowerCase();

// Every zone on the boat: colours placed on the Zone Map Overviews, then named Zone Map Photos.
export const boatZones = (boat) => {
  const out = [];
  const add = (label, colour) => { if (label && ZONE_COLOURS[colour] && !out.some((z) => low(z.label) === low(label))) out.push({ label, colour }); };
  const maps = boat?.zone_maps || [];
  maps.filter((m) => m.kind === "overview").forEach((m) => (m.swatches || []).forEach((s) => add(s.label || s.colour, s.colour)));
  maps.filter((m) => m.kind !== "overview").forEach((m) => add(m.zone || m.name, m.colour));
  return out;
};

// The Zone Map Photos of one zone: tagged with it, or named after it; same colour only as a last resort.
export const zonePhotos = (boat, zone) => {
  const own = (boat?.zone_maps || []).filter((m) => m.kind !== "overview");
  const l = low(zone.label);
  const esc = l.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
  const numbered = (m) => low(m.name) === l || new RegExp("^" + esc + " \\d+$").test(low(m.name));
  const hit = own.filter((m) => low(m.zone) === l || (!m.zone && numbered(m)));
  if (hit.length) return hit;
  const loose = own.filter((m) => !m.zone && l && low(m.name).includes(l));
  return loose.length ? loose : own.filter((m) => m.colour === zone.colour && !m.zone);
};
