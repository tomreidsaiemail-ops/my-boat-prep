const mk = (start, labels) => { let n = start; return labels.map((l) => (typeof l === "string" ? { id: n++, label: l, checked: false } : { id: l.id ?? n++, checked: false, ...l })); };
const POB_LABEL = "There are <PERSONS ON BOARD> persons on board POB. The boat is a white <BOAT_TYPE>. NOTE: If not white state correct colour of boat.";
const PANPAN_VESSEL = "This is [Vessel Name], [Vessel Name], [Vessel Name]. Callsign <Callsign>";
const MMSI_ITEM = { id: 400, label: "or MMSI Number (Optional, skipper to delete or add one)", checked: false };
const ALL_STATIONS = { id: 401, label: "ALL STATIONS, ALL STATIONS, ALL STATIONS", checked: false };
const PANPAN_TX = ["transmit: pan pan pan pan pan pan", "transmit: pan-pan pan-pan pan-pan"];
const radioText = (s) => s.replace(/\b(May|MAY|may) (Day|DAY|day)\b/g, (_, a, b) => (a === "MAY" ? "MAYDAY" : a + b.toLowerCase()))
  .replace(/(^|[^-\w])(Pan|PAN|pan) (Pan|PAN|pan)(?![-\w])/g, (_, pre, a, b) => `${pre}${a}-${b}`);
const RADIO_NAMES = { mayDay: "Mayday", panPan: "Pan-Pan" };
// One-off: the Mayday and Pan-Pan lists get their new names on every boat (radio_v2 marks it done).
const renameRadioLists = (registry) => registry?.map((l) => (RADIO_NAMES[l.id] && !l.radio_v2 ? { ...l, name: RADIO_NAMES[l.id], radio_v2: true } : l));
// Old fixed Mayday / Pan-Pan lines become lines filled in from Boat Details and GPS.
const UPGRADES = {
  "number of persons on board pob and vital information": { dynamic: "pobDescription", label: POB_LABEL },
  "state number of persons on board pob and vessel description": { dynamic: "pobDescription", label: POB_LABEL },
  "state current position lat long": { dynamic: "panPanPosition", label: "Report position [Position]" },
  "state vessel name call sign and mmsi number": { dynamic: "panPanVessel", label: PANPAN_VESSEL },
};
const upgradePob = (data) => {
  const fix = (items) => items?.flatMap((raw) => {
    const i = raw.dynamic || !raw.label ? raw : { ...raw, label: radioText(raw.label) };
    if (PANPAN_TX.includes((i.label || "").trim().toLowerCase()) && !items.some((x) => x.id === ALL_STATIONS.id || /^all stations/i.test(x.label || ""))) return [i, { ...ALL_STATIONS }];
    const up = !i.dynamic && UPGRADES[(i.label || "").trim().toLowerCase()];
    if (!up) return [i];
    const next = { ...i, ...up };
    return up.dynamic === "panPanVessel" && !items.some((x) => x.id === MMSI_ITEM.id) ? [next, { ...MMSI_ITEM, ...(i.indent ? { indent: true } : {}) }] : [next];
  });
  return data && (data.mayDay || data.panPan) ? { ...data, ...(data.mayDay ? { mayDay: fix(data.mayDay) } : {}), ...(data.panPan ? { panPan: fix(data.panPan) } : {}) } : data;
};


const RADIO_WAIT = "Wait for a response from either Coastguard Radio or Maritime Radio or nearby vessel. They will then ask for more information and confirm assistance is being sent to you as soon as possible. In addition, relay calls will be issued to alert any nearby vessels to your position - this is the benefit of making your Mayday call on the VHF.";

export const DEFAULT_REGISTRY = [
  { id: "leavingDock", name: "Leaving Dock", isSystem: true },
  { id: "returningDock", name: "Returning to Dock", isSystem: true },
  { id: "arrivingDest", name: "Arriving at Destination", isSystem: true },
  { id: "safety", name: "Safety", isSystem: true },
  { id: "riggingChecks", name: "Rigging Checks", isSystem: true },
  { id: "routeHazards", name: "Route Hazards", isSystem: true },
  { id: "crewPrep", name: "Crew Prep", isSystem: true },
  { id: "provisions", name: "Provisions", isSystem: true },
  { id: "head", name: "Head (Toilet)", isSystem: true },
  { id: "engineService", name: "Engine Service", isSystem: true },
  { id: "electricalService", name: "Electrical Service", isSystem: true },
  { id: "myTodo", name: "My To Do List", isSystem: true },
  { id: "shipsLog", name: "Ship's Log", isSystem: true },
  { id: "grabBag", name: "Grab Bag", isSystem: true },
  { id: "mayDay", name: "Mayday", isSystem: true, radio_v2: true },
  { id: "panPan", name: "Pan-Pan", isSystem: true, radio_v2: true },
];

export const DEFAULT_DATA = {
  leavingDock: mk(1, ["Tidy lines", "Free up head sail furler", "Secure Dinghy", "Remove main sail cover", "Drop lazy jacks", "Attach main halyard", "Fenders", "Wind direction check", "Boat hooks ready", "Assign crew life jackets", "Brief crew on exit plan", "Turn on instruments", "Set route on Navionics, and ready backup device if needed", "Text friend route, destination and ETA", "Lodge trip report with Coast Guard", "Set timer to close trip report"]),
  returningDock: mk(17, ["Fenders out", "Mooring lines ready", "Engine revs checked", "Crew briefed on docking", "Ready boat hooks", "Prepare crew with arrival plan", "Clear arrival timer"]),
  arrivingDest: mk(24, ["Ready boat hooks", "Anchor ready", "Mooring lines ready", "Brief crew", "Close trip report"]),
  safety: mk(29, ["Lifejackets and PFDs", "Flares and distress signals", "VHF Radio check", "Bilge pumps", "First aid kit", "Fire extinguishers", "Emergency tiller steering check", "Throwing line and life ring ready", "Emergency Grab Bag Ditch Bag"]),
  riggingChecks: mk(200, ["Shrouds and stays: no broken strands or kinks", "Bottlescrews pinned and taped", "Chainplates: no cracks or rust stains", "Forestay and furler: foil, drum and swivel turning freely", "Backstay and adjuster", "Spreaders and spreader ends taped", "Mast step and mast collar", "Masthead: wind instruments, lights and VHF aerial (check with binoculars)", "Halyards: no chafe, sheaves turning freely", "Sheets and running rigging: no chafe", "Shackles moused or seized", "Boom gooseneck and vang", "Mainsheet blocks and traveller", "Reefing lines run freely", "Lifelines, stanchions and pulpits secure"]),
  routeHazards: mk(38, ["Tide times check", "Shallow areas identified", "Weather alerts", "Local notices to mariners", "Dangerous rocks"]),
  crewPrep: mk(43, ["Hat with lanyard", "Glasses", "Sun glasses", "Sunscreen", "Insect repellent", "Scarf", "Gloves", "Jacket", "Sleeping bag", "Towel", "Toothbrush", "Brush", "Phone", "Credit cards", "Cash", "Phone cables", "Power banks", "Sea sickness tablets", "White soled trainers"]),
  provisions: mk(62, ["Water", "Beer", "Wine", "Nuts", "Crisps", "Dips", "Milk", "Powdered milk", "Tea", "Coffee", "Juice", "Bacon", "Sausage", "Eggs", "Bread", "Pasta", "Pasta sauce", "Mince", "Chicken", "Burgers", "Rice", "Potatoes", "Carrot", "Onion", "Tins various"]),
  head: mk(123, ["(Skipper) Sea Cocks open", "(Skipper) Redirect to holding tank when at dock", "Check readiness of toilet with skipper", "Only Flush 2 sheets of toilet paper", "Leave toilet as you found it", "10 seconds max for electric flush"]),
  engineService: mk(129, ["Fuel filter", "Oil filter", "Alternator belt", "Impeller", "Oil change", "Leak check", "Gearbox oil change", "Engine anode", "Exhaust elbow check"]),
  electricalService: mk(300, ["Battery terminals clean and tight", "Battery voltage and charge check", "Battery water levels", "Shore power lead and plug", "Battery charger and inverter check", "Fuses and breakers", "Wiring chafe and corrosion check", "Navigation and deck lights", "Bilge pump and float switch", "Solar panel and regulator connections", "Alternator output check", "Anchor windlass", "VHF and antenna connections"]),
  myTodo: [],
  shipsLog: mk(87, [{ dynamic: "logDate", label: "Departed [DATE] at <Time> for <Destination> with <Persons on Board> POB, expected arrival time <Time>." }]),
  grabBag: mk(88, ["EPIRB Activate and ensure it stays clear of obstructions", "Handheld VHF Radio Set to Channel 16 High Power", "Handheld GPS and spare batteries", "SART Search and Rescue Transponder", "Distress Flares Hand flares parachute rockets smoke signals", "Thermal Protective Aids TPAs Space blankets", "Waterproof torch flashlight and spare batteries", "Vessel documentation crew passports and ship logs", "Emergency drinking water and high energy rations", "First aid kit and critical personal medications", "Multi tool pocket knife and signaling mirror", "Handheld laser flare whistle"]),
  mayDay: mk(100, [
    "Check GPS position Confirm exact Latitude Longitude and milestones",
    "Tune VHF Radio to Channel 16",
    "Transmit: MAYDAY MAYDAY MAYDAY",
    { dynamic: "maydayVessel", label: "This is [Vessel Name], [Vessel Name], [Vessel Name]" },
    { dynamic: "maydayCallsign", label: "Callsign <Callsign>" },
    { dynamic: "maydayVesselCallsign", label: "MAYDAY [Vessel Name] [Callsign]" },
    "State Call Sign MMSI number and a brief description of the boat",
    { dynamic: "maydayGps", label: "Report position [Position]" },
    "Nature of distress sinking fire medical emergency",
    "Immediate assistance required",
    { dynamic: "pobDescription", label: POB_LABEL },
    "OVER",
    RADIO_WAIT,
  ]),
  panPan: mk(113, [
    { dynamic: "panPanGps", label: "Check GPS position [Position]" },
    "Tune VHF Radio to Channel 16",
    "Transmit: PAN-PAN PAN-PAN PAN-PAN",
    ALL_STATIONS,
    { dynamic: "panPanVessel", label: PANPAN_VESSEL },
    MMSI_ITEM,
    { dynamic: "panPanPosition", label: "Report position [Position]" },
    "State Nature of urgency loss of steering steering breakdown",
    "State Intended action assistance required non emergency tow",
    { dynamic: "pobDescription", label: POB_LABEL },
    "OVER",
    RADIO_WAIT,
  ]),
};

export const freshState = () => ({
  boat: { vessel: "", skipper: "", callsign: "", log_email: "", shore_email: "", boat_type: "", pob: 1 },
  log_sent: null,
  engine_log: [],
  electrical_log: [],
  deleted_lists: [],
  registry: DEFAULT_REGISTRY.map((r) => ({ ...r })),
  data: JSON.parse(JSON.stringify(DEFAULT_DATA)),
  updated_at: new Date(0).toISOString(),
});

export const PRESERVED_LISTS = ["shipsLog", "myTodo"];
export const TEMPLATE_IDS = DEFAULT_REGISTRY.map((l) => l.id).filter((id) => !PRESERVED_LISTS.includes(id));

// Lists the admin created in the Admin panel; they appear on every boat like built-in lists.
export const customTemplateLists = (templates) => Object.entries(templates || {}).filter(([, t]) => t.custom)
  .sort(([, a], [, b]) => (a.created_at < b.created_at ? -1 : 1)).map(([id, t]) => ({ id, name: t.name, isSystem: true }));
export const templateIds = (templates) => [...TEMPLATE_IDS, ...customTemplateLists(templates).map((l) => l.id)];

// Admin-published master template items, falling back to the built-in items.
export const templateItems = (id, templates) =>
  JSON.parse(JSON.stringify(templates?.[id]?.items || DEFAULT_DATA[id])).map((i) => ({ ...i, checked: false }));

const insertDefaultList = (registry, data, id, templates) => {
  const def = DEFAULT_REGISTRY.find((l) => l.id === id) || customTemplateLists(templates).find((l) => l.id === id);
  if (!def || registry.some((l) => l.id === id || l.name.toLowerCase() === def.name.toLowerCase())) return false;
  const later = DEFAULT_REGISTRY.includes(def) ? DEFAULT_REGISTRY.slice(DEFAULT_REGISTRY.indexOf(def) + 1).map((l) => l.id) : PRESERVED_LISTS;
  const at = registry.findIndex((l) => later.includes(l.id));
  registry.splice(at < 0 ? registry.length : at, 0, { ...def });
  data[id] = templateItems(id, templates);
  return true;
};

const addMissingLists = (s) => {
  const registry = [...s.registry];
  const data = { ...s.data };
  const deleted = s.deleted_lists || [];
  ["head", "engineService", "electricalService", "myTodo", "riggingChecks"].filter((id) => !deleted.includes(id)).forEach((id) => insertDefaultList(registry, data, id));
  return { ...s, registry, data, deleted_lists: deleted };
};

const markVersions = (s, ids, templates) => {
  const v = { ...(s.template_versions || {}) };
  ids.forEach((id) => { if (templates?.[id]) v[id] = templates[id].updated_at; });
  return v;
};

export const isOutdated = (s, id, templates) => !!templates?.[id] && templateIds(templates).includes(id)
  && s.registry.some((l) => l.id === id) && templates[id].updated_at > (s.template_versions?.[id] || "");

export const keepMine = (s, id, templates) => ({ ...s, template_versions: markVersions(s, [id], templates) });

export const applyTemplates = (s, templates) => {
  const data = { ...s.data };
  const ids = s.registry.filter((l) => TEMPLATE_IDS.includes(l.id)).map((l) => l.id);
  ids.forEach((id) => { data[id] = templateItems(id, templates); });
  return { ...s, data, template_versions: markVersions(s, ids, templates) };
};

// A new boat starts as a copy of the current one: lists unticked, voyage records and To Do cleared.
export const copyBoatState = (s, vessel) => {
  const data = Object.fromEntries(Object.entries(s.data).map(([id, items]) => [id, items.map((i) => ({ ...i, checked: false, flagged: false }))]));
  if (data.shipsLog) data.shipsLog = JSON.parse(JSON.stringify(DEFAULT_DATA.shipsLog));
  if (data.myTodo) data.myTodo = [];
  return {
    ...JSON.parse(JSON.stringify(s)), data, boat: { ...s.boat, vessel, callsign: "" },
    log_sent: null, engine_log: [], electrical_log: [], emergency_checked: {}, updated_at: new Date().toISOString(),
    areas: (s.areas || []).map((a) => ({ ...a, items: [] })),
  };
};

// Adds admin-created template lists the boat doesn't have yet (skipping ones the skipper deleted); null when nothing to add.
export const addTemplateLists = (s, templates) => {
  const registry = [...s.registry];
  const data = { ...s.data };
  const added = customTemplateLists(templates).filter((l) => !(s.deleted_lists || []).includes(l.id) && insertDefaultList(registry, data, l.id, templates));
  return added.length ? { ...s, registry, data, template_versions: markVersions(s, added.map((l) => l.id), templates) } : null;
};

export const resetOptions = (s, templates) => [...DEFAULT_REGISTRY.filter((l) => TEMPLATE_IDS.includes(l.id)), ...customTemplateLists(templates)]
  .map((l) => { const mine = s.registry.find((r) => r.id === l.id); return { id: l.id, name: mine?.name || l.name, deleted: !mine }; })
  .filter((o) => !o.deleted || (s.deleted_lists || []).includes(o.id))
  .map((o) => ({ ...o, clash: o.deleted && s.registry.some((r) => r.name.toLowerCase() === o.name.toLowerCase()) }));

export const resetLists = (s, ids, templates) => {
  const registry = [...s.registry];
  const data = { ...s.data };
  const restored = [];
  ids.forEach((id) => {
    if (registry.some((l) => l.id === id)) data[id] = templateItems(id, templates);
    else if (insertDefaultList(registry, data, id, templates)) restored.push(id);
  });
  const checked = { ...(s.emergency_checked || {}) };
  ids.forEach((id) => { delete checked[id]; });
  return { ...s, registry, data, deleted_lists: (s.deleted_lists || []).filter((id) => !restored.includes(id)), emergency_checked: checked, template_versions: markVersions(s, ids, templates) };
};

export const migrateState = (s) => s && addMissingLists({
  ...s,
  data: upgradePob(s.data),
  registry: renameRadioLists(s.registry.map((l) => (l.id === "shipsLog" && l.name === "Ship Log" ? { ...l, name: "Ship's Log" } : l))),
});

export const displayLabel = (item, ctx) => {
  const v = ctx.vessel || "Vessel Name";
  const c = ctx.callsign || "Callsign";
  switch (item.dynamic) {
    case "logDate": return item.label.replace("[DATE]", ctx.verboseDate);
    case "maydayVessel": return `This is ${v}, ${v}, ${v}`;
    case "maydayCallsign": return `Callsign ${c}`;
    case "maydayVesselCallsign": return `MAYDAY ${v} ${c}`;
    case "maydayGps": return `Report position ${ctx.position}`;
    case "panPanGps": return `Check GPS position ${ctx.position}`;
    case "panPanPosition": return `Report position ${ctx.position}`;
    case "panPanVessel": return `This is ${v}, ${v}, ${v}. Callsign ${c}`;
    case "pobDescription": return `There are ${ctx.pob || 1} persons on board POB. The boat is a white ${ctx.boatType || "[BOAT TYPE]"}. NOTE: If not white state correct colour of boat.`;
    default: return item.label;
  }
};

const SECTIONS = ["boat", "registry", "engine_log", "electrical_log", "deleted_lists", "emergency_checked", "template_versions", "log_sent", "areas"];

// Time-stamp what changed so the cloud can merge edits from several phones item by item.
export const stamp = (prev, next, now) => {
  const sec_ts = { ...(prev.sec_ts || {}) };
  SECTIONS.forEach((k) => { if (prev[k] !== next[k]) sec_ts[k] = now; });
  const list_ts = { ...(prev.list_ts || {}) };
  const data = { ...next.data };
  if (prev.data !== next.data) {
    Object.keys(next.data).forEach((id) => {
      const a = prev.data[id] || [];
      const b = next.data[id];
      if (a === b) return;
      const before = new Map(a.map((i) => [i.id, i]));
      data[id] = b.map((i) => (before.get(i.id) === i ? i : { ...i, ts: now }));
      if (a.length !== b.length || a.some((x, k) => x.id !== b[k].id)) list_ts[id] = now;
    });
  }
  return { ...next, data, sec_ts, list_ts };
};
