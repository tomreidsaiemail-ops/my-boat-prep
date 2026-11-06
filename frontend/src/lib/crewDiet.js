import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

// Allergies, food preferences and weights of registered crew on this boat (skipper only).
export const CrewDietContext = createContext(null);
export const useCrewDiet = () => useContext(CrewDietContext);

const NONE = /^(none|nil|no|nothing|n\/?a|-)\.?$/i;
export const real = (s) => !!String(s || "").trim() && !NONE.test(String(s).trim());
export const dietPeople = (people = []) => people.filter((p) => real(p.allergies) || real(p.food));
export const dietText = (people = []) => dietPeople(people)
  .map((p) => `${p.name}: ${[real(p.allergies) && `allergic to ${p.allergies}`, real(p.food) && `food preference ${p.food}`].filter(Boolean).join("; ")}`).join("\n").slice(0, 3000);
export const FOOD_RE = /meal|menu|food|provision|galley|recipe|breakfast|lunch|dinner|snack|cook|grocer|shopping|stores/i;
export const foodDiet = (diet, ...texts) => (diet?.text && texts.some((t) => FOOD_RE.test(t || "")) ? diet.text : "");

export const useOnBoardCrew = (boatId, online, enabled) => {
  const key = `mbp_onboard_${boatId}`;
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } });
  useEffect(() => {
    if (!enabled || !online) return undefined;
    const load = () => api.get(`/crew-register/on-board/${boatId}`, { timeout: 15000 })
      .then(({ data: d }) => { setData(d); localStorage.setItem(key, JSON.stringify(d)); }).catch(() => {});
    load();
    window.addEventListener("mbp:register-changed", load);
    return () => window.removeEventListener("mbp:register-changed", load);
  }, [boatId, online, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return enabled ? data : null;
};
