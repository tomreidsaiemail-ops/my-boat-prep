import { passagePlan, departureSummary, fuelOnBoard } from "../frontend/src/lib/telemetry.js";
const boat = { fuel_tank: "60", fuel_jerry: "2", water_tank: "100", gas_bottles: "2", gas_kg: "", gas_extra: "1", pob: 3, cruise_kn: "6", route_start: "Mana", route_dest: "Picton", batteries: [] };
const depart = { levels: { fuel: "half", water: "1q", gas: "full", bat_engine: "full", bat_house: "empty" }, calc: { distance_nm: 48, fuel_rate: 2.5 }, rate_reviewed: true, ack: true };
console.log("fuel on board", fuelOnBoard(boat, "half"));
const p = passagePlan(boat, depart);
console.log(p.fuelNeed, p.fuel, Math.round(p.range), p.warnings.map((w) => `${w.level}:${w.key}`), p.missing);
console.log(departureSummary(boat, depart, p, "now"));
console.log(passagePlan({ pob: 1 }, { levels: {}, calc: { distance_nm: 30, fuel_rate: 3 } }).missing);
