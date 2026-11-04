export const ZONE_COLOURS = {
  Gold: "#D4A017", Blue: "#1E63D6", Green: "#2E9D4A", Yellow: "#F2D33C", Orange: "#F28C28", Purple: "#7E3FBF", Pink: "#F06EAA",
  Brown: "#8B5A2B", Gray: "#8A8F98", Teal: "#14857F", Maroon: "#800020", Navy: "#1B2A6B", Turquoise: "#30C5D2", Lavender: "#B69DE0",
  Magenta: "#D0219F", Lime: "#9BD13B", Coral: "#FF7F66", Olive: "#7A7A2A", Beige: "#E3D3AE", Red: "#D62828",
};
export const PALETTE = Object.keys(ZONE_COLOURS);
const RAINBOW = ["Red", "Maroon", "Coral", "Orange", "Brown", "Gold", "Beige", "Yellow", "Olive", "Lime", "Green", "Teal", "Turquoise", "Blue", "Navy", "Lavender", "Purple", "Magenta", "Pink", "Gray"];

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
