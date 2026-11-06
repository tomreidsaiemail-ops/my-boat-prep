// Vessel telemetry (tanks and batteries) and the Leaving the Dock status check.
export const LEVELS = [
  { key: "full", label: "Full", value: 1, on: "bg-emerald-700 border-emerald-700 text-white", off: "border-emerald-700 text-emerald-800" },
  { key: "3q", label: "3/4", value: 0.75, on: "bg-lime-700 border-lime-700 text-white", off: "border-lime-600 text-lime-800" },
  { key: "half", label: "1/2", value: 0.5, on: "bg-amber-400 border-amber-500 text-[var(--navy)]", off: "border-amber-500 text-amber-800" },
  { key: "1q", label: "1/4", value: 0.25, on: "bg-orange-700 border-orange-700 text-white", off: "border-orange-600 text-orange-800" },
  { key: "empty", label: "Empty", value: 0, on: "bg-red-700 border-red-700 text-white", off: "border-red-700 text-red-800" },
];
const BY_KEY = Object.fromEntries(LEVELS.map((l) => [l.key, l]));
export const levelLabel = (k) => (BY_KEY[k] ? `${BY_KEY[k].label}${k === "1q" || k === "empty" ? " - LOW" : ""}` : "not checked");
export const isLow = (k) => k === "1q" || k === "empty";
export const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
const round = (n) => Math.round(n * 10) / 10;

export const CRUISE_DEFAULT = 6;
export const cruiseKn = (boat) => num(boat.cruise_kn) || CRUISE_DEFAULT;
// 1.34 x square root of the waterline length in feet (displacement hulls).
export const hullSpeed = (boat) => { const lwl = num(boat.lwl); return lwl ? 1.34 * Math.sqrt(boat.units === "ft" ? lwl : lwl * 3.28084) : 0; };
export const tankUnit = (boat) => (boat.tank_units === "gal" ? "gal" : "L");

export const ROLES = { engine: "Engine battery", house: "House bank", portable: "Portable battery" };
export const CHEMS = { lithium: "Lithium", flooded: "Flooded lead acid", agm: "AGM", gel: "Gel" };
const DEFAULT_BATTERIES = [{ id: "engine", role: "engine", make: "", volts: "", ah: "", chem: "", notes: "" }, { id: "house", role: "house", make: "", volts: "", ah: "", chem: "", notes: "" }];
export const batteriesOf = (boat) => (boat.batteries?.length ? boat.batteries : DEFAULT_BATTERIES);
export const batteryName = (b) => `${ROLES[b.role] || "Battery"}${b.make ? ` (${b.make})` : ""}`;
const batterySpec = (b) => [b.volts && `${b.volts}V`, num(b.ah) && `${num(b.ah)}Ah`, CHEMS[b.chem]].filter(Boolean).join(" ");

export const telemetryConfigured = (boat) => num(boat.fuel_tank) > 0 && num(boat.water_tank) > 0 && num(boat.gas_bottles) > 0 && num(boat.gas_kg) > 0
  && !!boat.batteries?.length && boat.batteries.every((b) => b.volts && num(b.ah) && b.chem);

// A blank can or bottle size means the usual one: 20 L (5 gal) jerry cans, 4.5 kg gas bottles.
export const canSize = (boat, key) => num(boat[key]) || (tankUnit(boat) === "gal" ? 5 : 20);
export const bottleKg = (boat) => num(boat.gas_kg) || 4.5;
// Jerry cans and spare gas bottles are counted as full.
export const fuelOnBoard = (boat, level) => (BY_KEY[level]?.value ?? 0) * num(boat.fuel_tank) + num(boat.fuel_jerry) * canSize(boat, "fuel_jerry_size");
export const waterOnBoard = (boat, level) => (BY_KEY[level]?.value ?? 0) * num(boat.water_tank) + num(boat.water_jerry) * canSize(boat, "water_jerry_size");
export const gasOnBoard = (boat, level) => ((BY_KEY[level]?.value ?? 0) * num(boat.gas_bottles) + num(boat.gas_extra)) * bottleKg(boat);

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
  const setUp = { fuel: num(boat.fuel_tank) + num(boat.fuel_jerry) > 0, water: num(boat.water_tank) + num(boat.water_jerry) > 0, gas: num(boat.gas_bottles) + num(boat.gas_extra) > 0 };
  const missing = Object.keys(setUp).filter((k) => !setUp[k]);
  if (distance && rate && setUp.fuel) {
    if (fuelNeed > fuel * (2 / 3)) warnings.push({ level: "red", key: "fuel", text: `Not enough fuel with a 1/3 reserve: this passage needs about ${round(fuelNeed)} ${unit} and you have about ${round(fuel)} ${unit}${jerry}. Safe range is about ${round(range * (2 / 3))} nm.` });
    else if (fuelNeed > fuel / 3) warnings.push({ level: "amber", key: "fuel", text: `Beyond the 1/3 rule: about ${round(fuelNeed)} ${unit} of your ${round(fuel)} ${unit}${jerry} gets you there with a reserve, but not back without refuelling.` });
  }
  if (distance && setUp.water && water < waterNeed) warnings.push({ level: "red", key: "water", text: `Water is short: ${pob} ${pob === 1 ? "person" : "people"} on board for ${days} ${days === 1 ? "day" : "days"} needs about ${round(waterNeed)} ${unit}; you have about ${round(water)} ${unit}${num(boat.water_jerry) ? " including jerry cans" : ""}.` });
  if (distance && setUp.gas && gas < gasNeed) warnings.push({ level: "amber", key: "gas", text: `LPG is low: about ${round(gas)} kg on board${num(boat.gas_extra) ? " including spare bottles" : ""} for an estimated ${round(gasNeed)} kg of cooking.` });
  return { unit, speed, rate, distance, hours, fuelNeed, fuel, range, water, gas, warnings, missing };
};

export const departureSummary = (boat, depart, plan, when) => {
  const unit = tankUnit(boat);
  const l = depart.levels || {};
  const parts = [
    `Departure check ${when}: Fuel ${levelLabel(l.fuel)} (about ${round(plan.fuel)} ${unit}${num(boat.fuel_jerry) ? ` incl. ${num(boat.fuel_jerry)} jerry cans` : ""})`,
    `Water ${levelLabel(l.water)} (about ${round(plan.water)} ${unit})`,
    `LPG ${levelLabel(l.gas)} (about ${round(plan.gas)} kg)`,
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

// Arrival: what is left (jerry cans and spare bottles still full can be counted down), so the passage's use can be logged.
const left = (arrive, key, all) => (arrive[key] === undefined || arrive[key] === "" ? all : Math.min(num(arrive[key]), all));
export const arrivalUsage = (boat, depart, arrive) => {
  const d = depart.levels || {};
  const a = arrive.levels || {};
  const fuelNow = (BY_KEY[a.fuel]?.value ?? 0) * num(boat.fuel_tank) + left(arrive, "fuel_jerry_left", num(boat.fuel_jerry)) * canSize(boat, "fuel_jerry_size");
  const waterNow = (BY_KEY[a.water]?.value ?? 0) * num(boat.water_tank) + left(arrive, "water_jerry_left", num(boat.water_jerry)) * canSize(boat, "water_jerry_size");
  const gasNow = ((BY_KEY[a.gas]?.value ?? 0) * num(boat.gas_bottles) + left(arrive, "gas_extra_left", num(boat.gas_extra))) * bottleKg(boat);
  const plan = passagePlan(boat, depart);
  const has = (k) => !!d[k] && !!a[k];
  const fuelUsed = has("fuel") ? fuelOnBoard(boat, d.fuel) - fuelNow : null;
  return {
    unit: tankUnit(boat), plan, fuelNow, waterNow, gasNow, fuelUsed,
    waterUsed: has("water") ? waterOnBoard(boat, d.water) - waterNow : null,
    gasUsed: has("gas") ? gasOnBoard(boat, d.gas) - gasNow : null,
    actualRate: fuelUsed > 0 && plan.hours ? fuelUsed / plan.hours : 0,
  };
};
export const usedText = (n, u) => (n === null ? "not known yet (pick the arrival level)" : n < 0 ? `topped up about ${round(-n)} ${u} on the way` : `about ${round(n)} ${u}`);

export const arrivalSummary = (boat, depart, arrive, use, when, listName) => {
  const u = use.unit;
  const l = arrive.levels || {};
  const parts = [
    `Arrival check (${listName}) ${when}: Fuel ${levelLabel(l.fuel)} (about ${round(use.fuelNow)} ${u} left)`,
    `Water ${levelLabel(l.water)} (about ${round(use.waterNow)} ${u} left)`,
    `LPG ${levelLabel(l.gas)} (about ${round(use.gasNow)} kg left)`,
    `Batteries: ${batteriesOf(boat).map((b) => `${batteryName(b)} ${levelLabel(l[`bat_${b.id}`])}${depart.levels?.[`bat_${b.id}`] ? ` (was ${levelLabel(depart.levels[`bat_${b.id}`])})` : ""}`).join(", ")}`,
    `Used on the passage${boat.route_start && boat.route_dest ? ` ${boat.route_start} to ${boat.route_dest}` : ""}: fuel ${usedText(use.fuelUsed, u)}${use.plan.fuelNeed ? ` (planned about ${round(use.plan.fuelNeed)} ${u})` : ""}, water ${usedText(use.waterUsed, u)}, LPG ${usedText(use.gasUsed, "kg")}`,
  ];
  if (use.actualRate) parts.push(`Actual fuel use about ${round(use.actualRate)} ${u}/h against ${round(use.plan.rate)} ${u}/h planned`);
  return `${parts.join(". ")}.`;
};

// Fuel and water top-ups and use: volume change, estimated weight change and the new tank level for the Ship's Log.
const GAL_L = 3.785;
const fuelKind = (engineType) => (/petrol|gasoline|benzin|outboard/i.test(engineType || "") ? "petrol" : "diesel");
const DENSITY = { diesel: 0.84, petrol: 0.74, water: 1 };
const nearestLevel = (f) => LEVELS.reduce((a, b) => (Math.abs(b.value - f) < Math.abs(a.value - f) ? b : a)).key;
export const tankChange = (boat, key, amount, added, levels = {}, amounts = {}, engineType = "") => {
  const unit = tankUnit(boat);
  const cap = num(boat[`${key}_tank`]);
  const kind = key === "fuel" ? fuelKind(engineType) : "water";
  const kg = amount * (unit === "gal" ? GAL_L : 1) * DENSITY[kind];
  const weight = boat.units === "ft" ? `${round(kg * 2.20462)} lb` : `${round(kg)} kg`;
  const name = key === "fuel" ? "Fuel" : "Water";
  const exact = amounts[key] !== undefined && cap && levels[key] === nearestLevel(amounts[key] / cap);
  const start = !cap || !levels[key] ? null : exact ? amounts[key] : BY_KEY[levels[key]].value * cap;
  if (start !== null && !added && amount > start + 0.05) return { error: `That's more than the ${round(start)} ${unit} in the tank.` };
  if (start !== null && added && start + amount > cap + 0.05) return { error: `That's more than the ${round(cap)} ${unit} tank can take (about ${round(start)} ${unit} in it now).` };
  const now = start === null ? null : Math.max(0, Math.min(cap, start + (added ? amount : -amount)));
  const level = now === null ? null : nearestLevel(now / cap);
  const tail = now === null ? "" : ` Tank now about ${round(now)} ${unit} of ${round(cap)} ${unit} (${levelLabel(level)}).`;
  const when = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const text = `${name} ${added ? "added" : "used"} ${round(amount)} ${unit}${key === "fuel" ? ` (${kind})` : ""}, estimated weight ${added ? "added" : "removed"} ${weight}, ${when}.${tail}`;
  return { text, level, now };
};


// Gas bottles: swap empties for full ones, or bring full spares on board / take spares off. Empty bottle weight is estimated as the gas it holds.
export const gasChange = (boat, count, mode, levels = {}) => {
  const kg = bottleKg(boat);
  const inUse = num(boat.gas_bottles);
  const spares = num(boat.gas_extra);
  const w = (k) => (boat.units === "ft" ? `${round(k * 2.20462)} lb` : `${round(k)} kg`);
  const s = (n) => (n === 1 ? "bottle" : "bottles");
  const when = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  if (mode === "swap") {
    if (inUse && count > inUse) return { error: `You have ${inUse} LPG ${s(inUse)} in use, so you can swap up to ${inUse}.` };
    const level = levels.gas && inUse ? nearestLevel(Math.min(1, BY_KEY[levels.gas].value + count / inUse)) : null;
    return { level, text: `LPG ${s(count)} swapped: ${count} empty for full (${round(kg)} kg each), estimated weight added ${w(count * kg)} of LPG, ${when}.${level ? ` LPG in use now ${levelLabel(level)}.` : ""}` };
  }
  if (mode === "remove" && count > spares) return { error: spares ? `There ${spares === 1 ? "is" : "are"} only ${spares} spare LPG ${s(spares)} on board.` : "There are no spare LPG bottles on board to take off." };
  const extra = mode === "add" ? spares + count : spares - count;
  const verb = mode === "add" ? "added" : "removed";
  return { extra, text: `LPG ${s(count)} ${verb}: ${count} full spare ${s(count)} of ${round(kg)} kg ${mode === "add" ? "brought on board" : "taken off"}, estimated weight ${verb} ${w(count * kg * 2)} (LPG ${w(count * kg)} plus about ${w(count * kg)} of bottle), ${when}. Spare bottles now ${extra}.` };
};
