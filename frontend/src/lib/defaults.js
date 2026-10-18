const mk = (start, labels) => labels.map((l, i) => (typeof l === "string" ? { id: start + i, label: l, checked: false } : { id: start + i, checked: false, ...l }));

const RADIO_WAIT = "Wait for a response from either Coastguard Radio or Maritime Radio or nearby vessel. They will then ask for more information and confirm assistance is being sent to you as soon as possible. In addition, relay calls will be issued to alert any nearby vessels to your position - this is the benefit of making your Mayday call on the VHF.";

export const DEFAULT_REGISTRY = [
  { id: "leavingDock", name: "Leaving Dock", isSystem: true },
  { id: "returningDock", name: "Returning to Dock", isSystem: true },
  { id: "arrivingDest", name: "Arriving at Destination", isSystem: true },
  { id: "safety", name: "Safety", isSystem: true },
  { id: "routeHazards", name: "Route Hazards", isSystem: true },
  { id: "crewPrep", name: "Crew Prep", isSystem: true },
  { id: "provisions", name: "Provisions", isSystem: true },
  { id: "head", name: "Head (Toilet)", isSystem: true },
  { id: "engineService", name: "Engine Service", isSystem: true },
  { id: "myTodo", name: "My To Do List", isSystem: true },
  { id: "shipsLog", name: "Ship's Log", isSystem: true },
  { id: "grabBag", name: "Grab Bag", isSystem: true },
  { id: "mayDay", name: "May Day", isSystem: true },
  { id: "panPan", name: "Pan Pan", isSystem: true },
];

export const DEFAULT_DATA = {
  leavingDock: mk(1, ["Tidy lines", "Free up head sail furler", "Secure Dinghy", "Remove main sail cover", "Drop lazy jacks", "Attach main halyard", "Fenders", "Wind direction check", "Boat hooks ready", "Assign crew life jackets", "Brief crew on exit plan", "Turn on instruments", "Set route on Navionics, and ready backup device if needed", "Text friend route, destination and ETA", "Lodge trip report with Coast Guard", "Set timer to close trip report"]),
  returningDock: mk(17, ["Fenders out", "Mooring lines ready", "Engine revs checked", "Crew briefed on docking", "Ready boat hooks", "Prepare crew with arrival plan", "Clear arrival timer"]),
  arrivingDest: mk(24, ["Ready boat hooks", "Anchor ready", "Mooring lines ready", "Brief crew", "Close trip report"]),
  safety: mk(29, ["Lifejackets and PFDs", "Flares and distress signals", "VHF Radio check", "Bilge pumps", "First aid kit", "Fire extinguishers", "Emergency tiller steering check", "Throwing line and life ring ready", "Emergency Grab Bag Ditch Bag"]),
  routeHazards: mk(38, ["Tide times check", "Shallow areas identified", "Weather alerts", "Local notices to mariners", "Dangerous rocks"]),
  crewPrep: mk(43, ["Hat with lanyard", "Glasses", "Sun glasses", "Sunscreen", "Insect repellent", "Scarf", "Gloves", "Jacket", "Sleeping bag", "Towel", "Toothbrush", "Brush", "Phone", "Credit cards", "Cash", "Phone cables", "Power banks", "Sea sickness tablets", "White soled trainers"]),
  provisions: mk(62, ["Water", "Beer", "Wine", "Nuts", "Crisps", "Dips", "Milk", "Powdered milk", "Tea", "Coffee", "Juice", "Bacon", "Sausage", "Eggs", "Bread", "Pasta", "Pasta sauce", "Mince", "Chicken", "Burgers", "Rice", "Potatoes", "Carrot", "Onion", "Tins various"]),
  head: mk(123, ["(Skipper) Sea Cocks open", "(Skipper) Redirect to holding tank when at dock", "Check readiness of toilet with skipper", "Only Flush 2 sheets of toilet paper", "Leave toilet as you found it", "10 seconds max for electric flush"]),
  engineService: mk(129, ["Fuel filter", "Oil filter", "Alternator belt", "Impeller", "Oil change", "Leak check", "Gearbox oil change", "Engine anode", "Exhaust elbow check"]),
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
    "Number of persons on board POB and vital information",
    "OVER",
    RADIO_WAIT,
  ]),
  panPan: mk(113, [
    { dynamic: "panPanGps", label: "Check GPS position [Position]" },
    "Tune VHF Radio to Channel 16",
    "Transmit: PAN PAN PAN PAN PAN PAN",
    "State Vessel Name Call Sign and MMSI number",
    "State Current position Lat Long",
    "State Nature of urgency loss of steering steering breakdown",
    "State Intended action assistance required non emergency tow",
    "State Number of persons on board POB and vessel description",
    "OVER",
    RADIO_WAIT,
  ]),
};

export const freshState = () => ({
  boat: { vessel: "", skipper: "", callsign: "", log_email: "", shore_email: "" },
  log_sent: null,
  engine_log: [],
  deleted_lists: [],
  registry: DEFAULT_REGISTRY.map((r) => ({ ...r })),
  data: JSON.parse(JSON.stringify(DEFAULT_DATA)),
  updated_at: new Date(0).toISOString(),
});

export const PRESERVED_LISTS = ["shipsLog", "myTodo"];
export const TEMPLATE_IDS = DEFAULT_REGISTRY.map((l) => l.id).filter((id) => !PRESERVED_LISTS.includes(id));

// Admin-published master template items, falling back to the built-in items.
export const templateItems = (id, templates) =>
  JSON.parse(JSON.stringify(templates?.[id]?.items || DEFAULT_DATA[id])).map((i) => ({ ...i, checked: false }));

const insertDefaultList = (registry, data, id, templates) => {
  const def = DEFAULT_REGISTRY.find((l) => l.id === id);
  if (registry.some((l) => l.id === id || l.name.toLowerCase() === def.name.toLowerCase())) return false;
  const later = DEFAULT_REGISTRY.slice(DEFAULT_REGISTRY.indexOf(def) + 1).map((l) => l.id);
  const at = registry.findIndex((l) => later.includes(l.id));
  registry.splice(at < 0 ? registry.length : at, 0, { ...def });
  data[id] = templateItems(id, templates);
  return true;
};

const addMissingLists = (s) => {
  const registry = [...s.registry];
  const data = { ...s.data };
  const deleted = s.deleted_lists || [];
  ["head", "engineService", "myTodo"].filter((id) => !deleted.includes(id)).forEach((id) => insertDefaultList(registry, data, id));
  return { ...s, registry, data, deleted_lists: deleted };
};

const markVersions = (s, ids, templates) => {
  const v = { ...(s.template_versions || {}) };
  ids.forEach((id) => { if (templates?.[id]) v[id] = templates[id].updated_at; });
  return v;
};

export const isOutdated = (s, id, templates) => !!templates?.[id] && TEMPLATE_IDS.includes(id)
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
    log_sent: null, engine_log: [], emergency_checked: {}, updated_at: new Date().toISOString(),
  };
};

export const resetOptions = (s) => DEFAULT_REGISTRY.filter((l) => TEMPLATE_IDS.includes(l.id))
  .map((l) => ({ id: l.id, name: l.name, deleted: !s.registry.some((r) => r.id === l.id) }))
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
  registry: s.registry.map((l) => (l.id === "shipsLog" && l.name === "Ship Log" ? { ...l, name: "Ship's Log" } : l)),
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
    default: return item.label;
  }
};
