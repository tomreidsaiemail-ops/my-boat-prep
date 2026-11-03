// Vessel telemetry (tanks and batteries) and the Leaving the Dock status check.
export const LEVELS = [
  { key: "full", label: "Full", value: 1, on: "bg-emerald-700 border-emerald-700 text-white", off: "border-emerald-700 text-emerald-800" },
  { key: "3q", label: "3/4", value: 0.75, on: "bg-lime-600 border-lime-600 text-white", off: "border-lime-600 text-lime-800" },
  { key: "half", label: "1/2", value: 0.5, on: "bg-amber-500 border-amber-500 text-white", off: "border-amber-500 text-amber-800" },
  { key: "1q", label: "1/4", value: 0.25, on: "bg-orange-600 border-orange-600 text-white", off: "border-orange-600 text-orange-800" },
  { key: "empty", label: "Empty", value: 0, on: "bg-red-700 border-red-700 text-white", off: "border-red-700 text-red-800" },
];
const BY_KEY = Object.fromEntries(LEVELS.map((l) => [l.key, l]));
export const levelLabel = (k) => BY_KEY[k]?.label || "not checked";
export const isLow = (k) => k === "1q" || k === "empty";
export const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
const round = (n) => Math.round(n * 10) / 10;

export const CRUISE_DEFAULT = 6;
export const cruiseKn = (boat) => num(boat.cruise_kn) || CRUISE_DEFAULT;
export const tankUnit = (boat) => (boat.tank_units === "gal" ? "gal" : "L");

export const ROLES = { engine: "Engine battery", house: "House bank", portable: "Portable battery" };
export const CHEMS = { lithium: "Lithium", flooded: "Flooded lead acid", agm: "AGM", gel: "Gel" };
const DEFAULT_BATTERIES = [{ id: "engine", role: "engine", make: "", volts: "", ah: "", chem: "", notes: "" }, { id: "house", role: "house", make: "", volts: "", ah: "", chem: "", notes: "" }];
export const batteriesOf = (boat) => (boat.batteries?.length ? boat.batteries : DEFAULT_BATTERIES);
export const batteryName = (b) => `${ROLES[b.role] || "Battery"}${b.make ? ` (${b.make})` : ""}`;
const batterySpec = (b) => [b.volts && `${b.volts}V`, num(b.ah) && `${num(b.ah)}Ah`, CHEMS[b.chem]].filter(Boolean).join(" ");

export const telemetryConfigured = (boat) => num(boat.fuel_tank) > 0 && num(boat.water_tank) > 0 && num(boat.gas_bottles) > 0 && num(boat.gas_kg) > 0
  && !!boat.batteries?.length && boat.batteries.every((b) => b.volts && num(b.ah) && b.chem);

// Jerry cans and spare gas bottles are counted as full.
export const fuelOnBoard = (boat, level) => (BY_KEY[level]?.value ?? 0) * num(boat.fuel_tank) + num(boat.fuel_jerry) * num(boat.fuel_jerry_size);
export const waterOnBoard = (boat, level) => (BY_KEY[level]?.value ?? 0) * num(boat.water_tank) + num(boat.water_jerry) * num(boat.water_jerry_size);
export const gasOnBoard = (boat, level) => ((BY_KEY[level]?.value ?? 0) * num(boat.gas_bottles) + num(boat.gas_extra)) * num(boat.gas_kg);

const WATER_PER_DAY = { L: 4, gal: 1 };
const GAS_KG_PER_DAY = 0.1;

// Range and warnings for the passage, from the Magic Mariner's estimate or the skipper's own figures.
export const passagePlan = (boat, depart) => {
  const calc = depart.calc || {};
  const unit = tankUnit(boat);
  const speed = cruiseKn(boat);
  const rate = num(depart.rate_override) || num(calc.fuel_rate);
  const distance = num(depart.distance_override) || num(calc.distance_nm);
  const levels = depart.levels || {};
  const fuel = fuelOnBoard(boat, levels.fuel);
  const hours = distance / speed;
  const fuelNeed = hours * rate;
  const range = rate ? (fuel / rate) * speed : 0;
  const pob = Math.max(1, boat.pob || 1);
  const days = Math.max(1, boat.trip_days || Math.ceil(hours / 24));
  const waterNeed = pob * days * WATER_PER_DAY[unit];
  const gasNeed = pob * days * GAS_KG_PER_DAY;
  const water = waterOnBoard(boat, levels.water);
  const gas = gasOnBoard(boat, levels.gas);
  const jerry = num(boat.fuel_jerry) ? ` including ${num(boat.fuel_jerry)} jerry ${num(boat.fuel_jerry) === 1 ? "can" : "cans"}` : "";
  const warnings = [];
  if (distance && rate) {
    if (fuelNeed > fuel * (2 / 3)) warnings.push({ level: "red", key: "fuel", text: `Not enough fuel with a 1/3 reserve: this passage needs about ${round(fuelNeed)} ${unit} and you have about ${round(fuel)} ${unit}${jerry}. Safe range is about ${round(range * (2 / 3))} nm.` });
    else if (fuelNeed > fuel / 3) warnings.push({ level: "amber", key: "fuel", text: `Beyond the 1/3 rule: about ${round(fuelNeed)} ${unit} of your ${round(fuel)} ${unit}${jerry} gets you there with a reserve, but not back without refuelling.` });
  }
  if (distance && water < waterNeed) warnings.push({ level: "red", key: "water", text: `Water is short: ${pob} on board for ${days} ${days === 1 ? "day" : "days"} needs about ${round(waterNeed)} ${unit}; you have about ${round(water)} ${unit}${num(boat.water_jerry) ? " including jerry cans" : ""}.` });
  if (distance && gas < gasNeed) warnings.push({ level: "amber", key: "gas", text: `Gas is low: about ${round(gas)} kg on board${num(boat.gas_extra) ? " including spare bottles" : ""} for an estimated ${round(gasNeed)} kg of cooking.` });
  return { unit, speed, rate, distance, hours, fuelNeed, fuel, range, water, gas, warnings };
};

export const departureSummary = (boat, depart, plan, when) => {
  const unit = tankUnit(boat);
  const l = depart.levels || {};
  const parts = [
    `Departure check ${when}: Fuel ${levelLabel(l.fuel)} (about ${round(plan.fuel)} ${unit}${num(boat.fuel_jerry) ? ` incl. ${num(boat.fuel_jerry)} jerry cans` : ""})`,
    `Water ${levelLabel(l.water)} (about ${round(plan.water)} ${unit})`,
    `Gas ${levelLabel(l.gas)} (about ${round(plan.gas)} kg)`,
    `Batteries: ${batteriesOf(boat).map((b) => `${batteryName(b)}${batterySpec(b) ? ` ${batterySpec(b)}` : ""} ${levelLabel(l[`bat_${b.id}`])}`).join(", ")}`,
  ];
  if (plan.distance && plan.rate) {
    const src = num(depart.rate_override) ? "skipper's figure" : depart.rate_reviewed ? "Magic Mariner estimate, reviewed by the skipper" : "Magic Mariner estimate";
    parts.push(`Passage ${boat.route_start || "?"} to ${boat.route_dest || "?"}: about ${round(plan.distance)} nm at ${plan.speed} kn (${round(plan.hours)} h), fuel use ${round(plan.rate)} ${unit}/h (${src}), needs about ${round(plan.fuelNeed)} ${unit}, range about ${round(plan.range)} nm`);
    if (plan.warnings.length) parts.push(`Warnings: ${plan.warnings.map((w) => w.text).join(" ")}`);
    if (depart.ack) parts.push(`Skipper acknowledged fuel management on route and holding about ${plan.speed} kn`);
  }
  return `${parts.join(". ")}.`;
};
