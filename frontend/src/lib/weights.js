// Racing weight: on-deck gear per Boat Maintenance category, fluids, provisions, crew and the All-Up Racing Displacement.
import { MAINT_KIND, MAINT_LISTS, attrsForList } from "@/lib/maint";
import { bottleKg, fuelOnBoard, num, tankUnit, waterOnBoard, gasOnBoard } from "@/lib/telemetry";

const TO_KG = { g: 0.001, kg: 1, lb: 0.453592, oz: 0.0283495 };
const GAL_L = 3.785;
export const CREW_DEFAULT = { kg: 85, lb: 187 };
export const weightUnit = (boat) => (boat.units === "ft" ? "lb" : "kg");
export const fmtKg = (kg, unit) => `${(Math.round((unit === "lb" ? kg / TO_KG.lb : kg) * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
const inKg = (v, unit) => num(v) * TO_KG[unit];

// Every "decimal weight" attribute of every item (categories included) in kg.
export const listWeightKg = (items, keys, boatUnit) => items.reduce((sum, i) => sum + keys.reduce((s, k) => s + num(i.attrs?.[k]) * (TO_KG[i.attrs?.[`${k}__unit`]] || TO_KG[boatUnit]), 0), 0);
const weightKeys = (defs, list) => attrsForList(defs, list).filter((d) => d.type === "decimal weight").map((d) => d.key);

export const gearTotals = (registry, data, defs, boatUnit) => MAINT_LISTS.map((m) => {
  const lists = registry.filter((l) => l.kind === MAINT_KIND && l.maint === m.key);
  return { ...m, has: lists.length > 0, kg: lists.reduce((s, l) => s + listWeightKg(data[l.id] || [], weightKeys(defs, l), boatUnit), 0) };
});

// Latest Leaving the Dock levels; a tank without a picked level counts as full.
const fuelDensity = (engineType) => (/petrol|gasoline|benzin|outboard/i.test(engineType || "") ? 0.74 : 0.84);
export const fluidsKg = (boat, engineType) => {
  const l = boat.depart?.levels || {};
  const litres = tankUnit(boat) === "gal" ? GAL_L : 1;
  const bottles = (num(boat.gas_bottles) + num(boat.gas_extra)) * bottleKg(boat);
  return {
    fuel: fuelOnBoard(boat, l.fuel || "full") * litres * fuelDensity(engineType),
    water: waterOnBoard(boat, l.water || "full") * litres,
    gas: gasOnBoard(boat, l.gas || "full") + (num(boat.gas_bottles) + num(boat.gas_extra) ? bottles : 0),
    fromLevels: !!(l.fuel || l.water || l.gas),
  };
};

// Scanned shopping keeps each item's weight per unit (unit_g), so stores weigh what's still on board.
export const provisionsKg = (areas = []) => areas.reduce((s, a) => s + (a.items || []).reduce((t, i) => t + (i.removed ? 0 : num(i.qty) * num(i.unit_g)), 0), 0) / 1000;

export const weighUp = ({ boat, registry, data, defs, areas, engineType }) => {
  const unit = weightUnit(boat);
  const gear = gearTotals(registry, data, defs, unit);
  const gearKg = gear.reduce((s, g) => s + g.kg, 0);
  const fluids = fluidsKg(boat, engineType);
  const fluidKg = fluids.fuel + fluids.water + fluids.gas;
  const provKg = provisionsKg(areas);
  const pob = boat.pob || 1;
  const avg = num(boat.crew_weight) || CREW_DEFAULT[unit];
  const crewKg = pob * inKg(avg, unit);
  const boatKg = inKg(boat.boat_weight, unit);
  return { unit, gear, gearKg, fluids, fluidKg, provKg, pob, avg, avgDefault: !num(boat.crew_weight), crewKg, boatKg, totalKg: boatKg + gearKg + fluidKg + provKg + crewKg };
};
