const word = (w) => (l) => new RegExp(`\\b${w}\\b`, "i").test(l);
// Kinds of zone among the Admin colours, shared by the Set Up Wizard and the Colours panel's drop downs.
export const isHead = word("head");
export const isCabin = (l) => word("cabin")(l) && !/cabin top/i.test(l);
export const isEngineRoom = word("engine room");
const OTHER = [/^galley$/i, /^saloon$/i, /^cockpit$/i, /^nav station$/i, /^transom$/i];
// The Add main five.
export const isMainZone = (l) => OTHER.some((re) => re.test(String(l || "").trim()));

export const ZONE_GROUPS = [
  { key: "head", label: "Add head", pick: (presets) => presets.filter((p) => isHead(p.label)) },
  { key: "cabin", label: "Add cabin", pick: (presets) => presets.filter((p) => isCabin(p.label)) },
  { key: "engine", label: "Add engine", pick: (presets) => presets.filter((p) => isEngineRoom(p.label)) },
  { key: "other", label: "Add main", pick: (presets) => OTHER.map((re) => presets.find((p) => re.test(p.label.trim()))).filter(Boolean) },
];
