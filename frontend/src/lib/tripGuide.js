import { useEffect, useState } from "react";
import { glow, wait } from "@/lib/glow";

// The step-by-step Trip Planning guide on the Model Vessel: where the skipper is in it, kept on this device per user.
// "" = not started yet (it starts on the next Model Vessel visit to Trip Planning), "off" = skipped, "done" = finished.
export const STAGES = ["intro", "bubbles", "quick", "map", "filled", "leave", "leaveOk", "underway", "types", "click", "arrived", "newdep", "newdepGo", "returning", "complete", "done"];
// Help > Model Vessel entry that starts the guide again.
export const TRIP_GUIDE = { key: "trip-planning-guide", title: "Trip Planning step-by-step guide" };
const KEY = (uid) => `mbp_trip_guide:${uid}`;
const EV = "mbp:trip-guide";
const read = (uid) => { try { return JSON.parse(localStorage.getItem(KEY(uid))) || {}; } catch { return {}; } };

export const guideSet = (uid, patch) => {
  localStorage.setItem(KEY(uid), JSON.stringify({ ...read(uid), ...patch }));
  window.dispatchEvent(new Event(EV));
};
// From the top, on the Model Vessel's Trip Planning.
export const guideRestart = (uid) => guideSet(uid, { stage: "", go: true, seen: {} });

export const useTripGuide = (uid) => {
  const [g, setG] = useState(() => read(uid));
  useEffect(() => {
    const up = () => setG(read(uid));
    up();
    window.addEventListener(EV, up);
    return () => window.removeEventListener(EV, up);
  }, [uid]);
  return { ...g, stage: g.stage || "", seen: g.seen || {}, set: (patch) => guideSet(uid, patch), to: (stage) => guideSet(uid, { stage }),
    see: (k) => guideSet(uid, { seen: { ...(read(uid).seen || {}), [k]: true } }), skip: () => guideSet(uid, { stage: "off" }) };
};

const at = (s) => STAGES.indexOf(s);
export const reached = (stage, s) => at(stage) >= 0 && at(stage) >= at(s);
export const between = (stage, a, b) => reached(stage, a) && at(stage) <= at(b);

// Where the guide goes once something is logged: a departure, an arrival on either list, or a New departure.
export const guideAfter = (stage, what) => {
  if (what === "depart" && between(stage, "filled", "leaveOk")) return "underway";
  if (what === "arrivingDest" && between(stage, "underway", "click")) return "arrived";
  if (what === "interim" && between(stage, "arrived", "newdepGo")) return "returning";
  if (what === "returningDock" && between(stage, "arrived", "returning")) return "complete";
  return stage;
};

// A yellow highlight that stays on while the step needs it, picking up the element whenever it (re)appears.
export const useHold = (testId, on = true) => useEffect(() => {
  if (!on || !testId) return undefined;
  const put = () => document.querySelectorAll(`[data-testid="${testId}"]`).forEach((e) => e.classList.add("mbp-glow"));
  put();
  const t = setInterval(put, 400);
  return () => { clearInterval(t); document.querySelectorAll(`[data-testid="${testId}"]`).forEach((e) => e.classList.remove("mbp-glow")); };
}, [testId, on]);

// Scrolls the first of these into view if it's off screen, then highlights them all yellow together.
export const spot = (ids, ms = 5000) => {
  const el = ids.map((id) => document.querySelector(`[data-testid="${id}"]`)).find(Boolean);
  const r = el?.getBoundingClientRect();
  if (r && (r.top < 0 || r.bottom > window.innerHeight)) el.scrollIntoView({ behavior: "smooth", block: "center" });
  return Promise.all(ids.map((id) => glow(id, ms)));
};

// Runs each step's 5-second highlight in turn, once per guide run; returns how many steps have shown (all of them once seen).
export const useGuideSteps = (guide, key, steps, on = true) => {
  const seen = !!guide.seen[key];
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on || seen) return undefined;
    let live = true;
    (async () => {
      await wait(300);
      for (let i = 0; i < steps.length; i += 1) {
        if (!live) return;
        setN(i);
        await spot(steps[i]);
      }
      if (live) { setN(steps.length); guide.see(key); }
    })();
    return () => { live = false; };
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  return on && !seen ? n : steps.length;
};
