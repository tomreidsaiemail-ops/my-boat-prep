// The MAYDAY and PAN-PAN call scripts: the admin's "ADMIN - MAYDAY TEMPLATE" / "ADMIN - PAN-PAN TEMPLATE" (these lines until they load), filled in from the boat and GPS.
export const RADIO_TEMPLATES = { mayDay: "ADMIN - MAYDAY TEMPLATE", panPan: "ADMIN - PAN-PAN TEMPLATE" };
const OTHER = "Other information - there are <POB> persons on board (POB). The boat is a <BOAT COLOUR> <BOAT TYPE>. Length <LENGTH>. <Optional MMSI Number>";
export const RADIO_LINES = {
  mayDay: [
    "Tune VHF Radio to Channel 16", "Transmit: MAYDAY MAYDAY MAYDAY", "This is <BOAT NAME>, <BOAT NAME>, <BOAT NAME>", "Callsign <CALLSIGN>",
    "MAYDAY <BOAT NAME> <CALLSIGN>", "We are at (state your general geographical position) at position <GPS>", "Nature of distress and what assistance is required",
    OTHER, "OVER",
    "Allow a short time for a response. If no reply, repeat the distress call, working through all the distress frequencies on the radio. If contact is made with a shore station, tell them you have activated your distress beacon and follow their instructions.",
  ],
  panPan: [
    "Tune VHF Radio to Channel 16", "Transmit: PAN-PAN PAN-PAN PAN-PAN", "ALL STATIONS, ALL STATIONS, ALL STATIONS", "This is <BOAT NAME>, <BOAT NAME>, <BOAT NAME>",
    "Callsign <CALLSIGN>", "We are at (state your general geographical position) at position <GPS>", "Nature of urgency and what assistance is required",
    OTHER, "OVER",
    "Allow a short time for a response. If no reply, repeat the urgency call, working through all the frequencies on the radio. If contact is made with a shore station, tell them you are ready to activate your distress beacon and follow their instructions.",
  ],
};

const START = { mayDay: 1000, panPan: 2000 };
const step = (l) => String(l || "").trim().replace(/^\d+[.)]\s*/, "");
// The skipper's list: one item per template step (any "1." numbering dropped), filled in when shown.
export const radioItems = (kind, lines) => (lines?.length ? lines : RADIO_LINES[kind]).map(step).filter(Boolean).slice(0, 300)
  .map((label, n) => ({ id: START[kind] + n, label, checked: false, dynamic: "radioFill" }));
export const sameScript = (a = [], b = []) => a.length === b.length && a.every((i, n) => i.id === b[n].id && i.label === b[n].label && i.dynamic === b[n].dynamic);

const TAG = /<\s*([A-Za-z][A-Za-z ]*[A-Za-z])\s*>/g;
const tagKey = (t) => t.toUpperCase().replace(/[^A-Z]/g, "");
const low = (v) => String(v || "").trim().toLowerCase();
const colour = (c) => { const h = low(c.hull), d = low(c.deck); return !h || !d ? "" : h === d ? h : `${h} hull and ${d} deck`; };
const NATO = { A: "Alpha", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel", I: "India", J: "Juliet", K: "Kilo", L: "Lima", M: "Mike",
  N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "X-ray", Y: "Yankee", Z: "Zulu" };
// "ZMT123" reads "ZMT123 - Zulu Mike Tango 123".
export const phonetic = (cs) => {
  const s = String(cs || "").trim(), parts = s.toUpperCase().match(/[A-Z]|\d+/g) || [];
  return parts.some((p) => NATO[p]) ? `${s} - ${parts.map((p) => NATO[p] || p).join(" ")}` : s;
};
const VALUES = {
  BOATNAME: (c) => c.vessel, VESSEL: (c) => c.vessel, VESSELNAME: (c) => c.vessel, CALLSIGN: (c) => phonetic(c.callsign), GPS: (c) => c.position, POSITION: (c) => c.position,
  POB: (c) => (c.pob ? String(c.pob) : ""), BOATCOLOUR: colour, BOATCOLOR: colour, BOATTYPE: (c) => c.boatType, LENGTH: (c) => c.length, MMSI: (c) => c.mmsi,
  OPTIONALMMSINUMBER: (c) => (c.mmsi ? `MMSI ${c.mmsi}.` : ""),
};
const OPTIONAL = new Set(["OPTIONALMMSINUMBER"]);
// The boat details each tag needs (GPS comes from the phone).
const NEEDS = { BOATNAME: ["vessel"], VESSEL: ["vessel"], VESSELNAME: ["vessel"], CALLSIGN: ["callsign"], POB: ["pob"], BOATCOLOUR: ["hull_colour", "deck_colour"],
  BOATCOLOR: ["hull_colour", "deck_colour"], BOATTYPE: ["boat_type"], LENGTH: ["loa"], MMSI: ["mmsi"], OPTIONALMMSINUMBER: ["mmsi"] };

// "a <BOAT COLOUR> <BOAT TYPE>" reads "a white Catamaran", or "a Catamaran with a white hull and blue deck". A missing detail keeps its tag; the optional MMSI just drops out.
export const fillRadio = (text, c) => String(text || "")
  .replace(/<\s*BOAT\s*COLOU?R\s*>\s*<\s*BOAT\s*TYPE\s*>/gi, (all) => (!c.boatType || !colour(c) ? all
    : low(c.hull) === low(c.deck) ? `${colour(c)} ${c.boatType}` : `${c.boatType} with a ${low(c.hull)} hull and ${low(c.deck)} deck`))
  .replace(TAG, (all, t) => { const k = tagKey(t); if (!VALUES[k]) return all; const v = String(VALUES[k](c) || "").trim(); return v || (OPTIONAL.has(k) ? "" : all); })
  .replace(/\s{2,}/g, " ").trim();

const fieldsIn = (label, optional) => [...String(label || "").matchAll(TAG)].flatMap((m) => { const k = tagKey(m[1]); return !optional && OPTIONAL.has(k) ? [] : NEEDS[k] || []; });
// The details a line fills in (lit in MAYDAY set up), and the ones the scripts need before they're set up.
export const lineFields = (label) => fieldsIn(label, true);
export const radioFields = (items = []) => [...new Set(items.filter((i) => i.dynamic === "radioFill").flatMap((i) => fieldsIn(i.label, false)))];
