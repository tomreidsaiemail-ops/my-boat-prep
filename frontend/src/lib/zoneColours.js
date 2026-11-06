export const ZONE_COLOURS = {
  Gold: "#D4A017", Blue: "#1E63D6", Green: "#2E9D4A", Yellow: "#F2D33C", Orange: "#F28C28", Purple: "#7E3FBF", Pink: "#F06EAA",
  Brown: "#8B5A2B", Gray: "#8A8F98", Teal: "#14857F", Maroon: "#800020", Navy: "#1B2A6B", Turquoise: "#30C5D2", Lavender: "#B69DE0",
  Magenta: "#D0219F", Lime: "#9BD13B", Coral: "#FF7F66", Olive: "#7A7A2A", Beige: "#E3D3AE", Red: "#D62828",
  "Light Red": "#F07070", "Lime Green": "#32CD32", Copper: "#B87333", Emerald: "#10A060", Peach: "#FFC59E", Mint: "#98E2C0", Tan: "#D2B48C",
  Sepia: "#704214", Chartreuse: "#B8E000", "Sky Blue": "#7CC4F0", Crimson: "#B0102C", Plum: "#8E4585", Amber: "#FFB300", Violet: "#8F00FF",
  Salmon: "#FA8072", Silver: "#B8BEC6", Indigo: "#3F2A9E", Aqua: "#00C7C7", Khaki: "#C3B091", Rust: "#B7410E", Mustard: "#D8A31A",
  Cream: "#F3E9C6", Charcoal: "#36454F", Rose: "#E8507A", Jade: "#00A86B", Cobalt: "#0047AB", Lilac: "#C8A2C8", Burgundy: "#6D1A36",
  Ochre: "#CC7722", Slate: "#6A7B8C",
};
export const PALETTE = Object.keys(ZONE_COLOURS);
const RAINBOW = ["Red", "Crimson", "Light Red", "Rose", "Maroon", "Burgundy", "Coral", "Salmon", "Peach", "Orange", "Rust", "Copper", "Ochre", "Brown", "Sepia", "Tan", "Khaki",
  "Gold", "Amber", "Mustard", "Beige", "Cream", "Yellow", "Chartreuse", "Olive", "Lime", "Lime Green", "Green", "Emerald", "Jade", "Mint", "Teal", "Aqua", "Turquoise",
  "Sky Blue", "Blue", "Cobalt", "Navy", "Indigo", "Violet", "Lavender", "Lilac", "Purple", "Plum", "Magenta", "Pink", "Silver", "Gray", "Slate", "Charcoal"];
// Light colours need dark writing on them.
export const LIGHT = new Set(["Yellow", "Beige", "Lime", "Turquoise", "Lavender", "Gold", "Peach", "Mint", "Tan", "Chartreuse", "Sky Blue", "Amber", "Salmon", "Silver",
  "Aqua", "Khaki", "Cream", "Lilac", "Mustard", "Lime Green", "Coral", "Light Red"]);

export const mapLabel = (m, n) => m.name || `Zone map ${n + 1}`;

// Area id -> the colour and name of the zone map it's pinned on; folders and boxes take their cupboard's.
export const areaZones = (boat, areas) => {
  const out = {};
  (boat?.zone_maps || []).forEach((m, n) => (m.pins || []).forEach((p) => {
    if (p.area_id && !out[p.area_id] && ZONE_COLOURS[m.colour]) out[p.area_id] = { colour: m.colour, hex: ZONE_COLOURS[m.colour], map: mapLabel(m, n), rank: RAINBOW.indexOf(m.colour) };
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
