import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { allBatteries, num } from "@/lib/telemetry";

const sigOf = (b) => [b.make, b.model, b.year_built].map((x) => String(x || "").trim().toLowerCase()).join("|");

// Magic Marine Navigator: once make, model and year are filled in, quietly guess the fuel and water tanks, LPG bottles and house bank Ah.
// Only empty fields are filled; each make/model/year is asked once.
export const useTankGuess = ({ boat, mutate, on }) => {
  const sig = sigOf(boat);
  const gaps = ["fuel_tank", "water_tank", "gas_bottles", "gas_kg"].some((k) => !num(boat[k])) || allBatteries(boat).some((x) => x.role === "house" && !num(x.ah));
  const ready = on && gaps && !!String(boat.make || "").trim() && !!String(boat.model || "").trim() && /^\d{4}$/.test(String(boat.year_built || "")) && boat.tank_guess_for !== sig;
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(async () => {
      let d = null;
      try {
        ({ data: d } = await api.post("/ai/tank-guess", { make: boat.make.trim(), model: boat.model.trim(), year_built: String(boat.year_built), boat_type: boat.boat_type || "",
          loa: String(boat.loa || ""), units: boat.units === "ft" ? "ft" : "m", tank_units: boat.tank_units === "gal" ? "gal" : "L" }, { quiet: true }));
      } catch { /* tried once for this make/model/year */ }
      const empty = (k, v) => !!(d && v && !num(boat[k]));
      const told = empty("fuel_tank", d?.fuel) || empty("water_tank", d?.water) || empty("gas_bottles", d?.lpg_bottles) || empty("gas_kg", d?.lpg_kg)
        || !!(d?.house_ah && allBatteries(boat).some((x) => x.role === "house" && !num(x.ah)));
      mutate((s) => {
        const b = s.boat || {};
        const put = (k, v) => (d && v && !num(b[k]) ? { [k]: String(v) } : {});
        const bats = allBatteries(b).map((x) => (d?.house_ah && x.role === "house" && !num(x.ah) ? { ...x, ah: String(d.house_ah) } : x));
        return { ...s, boat: { ...b, ...put("fuel_tank", d?.fuel), ...put("water_tank", d?.water), ...put("gas_bottles", d?.lpg_bottles), ...put("gas_kg", d?.lpg_kg),
          ...(d?.house_ah ? { batteries: bats } : {}), tank_guess_for: sig } };
      }, { count: false });
      if (told) toast.success("Magic Marine Navigator filled in your tank sizes, LPG and house bank. Check them in Additional Boat Details.");
    }, 2500);
    return () => clearTimeout(t);
  }, [ready, sig]); // eslint-disable-line react-hooks/exhaustive-deps
};
