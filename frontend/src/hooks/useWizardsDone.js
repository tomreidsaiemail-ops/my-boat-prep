import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const DONE = "mbp-wizard-done";
const doneKey = (uid) => `mbp_wizards_done:${uid}`;
const read = (uid) => { try { return JSON.parse(localStorage.getItem(doneKey(uid))) || []; } catch { return []; } };
const progressKey = (uid) => `mbp_training_progress:${uid}`;
const readProgress = (uid) => { try { return JSON.parse(localStorage.getItem(progressKey(uid))) || {}; } catch { return {}; } };

// Opened / finished a Model Vessel walkthrough: counted for Analytics, and finished ones get a tick in Help.
export const wizardEvent = (uid, wizard, event) => {
  if (event === "finish") {
    localStorage.setItem(doneKey(uid), JSON.stringify([...new Set([...read(uid), wizard])]));
    window.dispatchEvent(new Event(DONE));
  }
  api.post("/wizards/event", { wizard, event }).then(({ data }) => {
    if (!data.credited) return;
    const p = readProgress(uid);
    localStorage.setItem(progressKey(uid), JSON.stringify({ ...p, credited: { ...(p.credited || {}), [wizard]: data.credited }, total_credited: (p.total_credited || 0) + data.credited }));
    window.dispatchEvent(new Event(DONE));
    toast.success(`Well done! ${data.credited} extra magic added to your account for finishing this tutorial.`);
  }).catch(() => {});
};

// Finished tutorials with when, and the extra magic each one earned (Training Progress, Help ticks).
export const useTrainingProgress = (uid, online) => {
  const [p, setP] = useState(() => readProgress(uid));
  useEffect(() => {
    const up = () => setP(readProgress(uid));
    window.addEventListener(DONE, up);
    return () => window.removeEventListener(DONE, up);
  }, [uid]);
  useEffect(() => {
    if (!online || !uid) return;
    api.get("/wizards/mine").then(({ data }) => { localStorage.setItem(progressKey(uid), JSON.stringify(data)); setP(data); }).catch(() => {});
  }, [uid, online]);
  return { finished: p.finished || read(uid), credited: p.credited || {}, finishedAt: p.finished_at || {}, total: p.total_credited || 0 };
};

export default function useWizardsDone(uid, online) {
  const [done, setDone] = useState(() => read(uid));
  useEffect(() => {
    const up = () => setDone(read(uid));
    window.addEventListener(DONE, up);
    return () => window.removeEventListener(DONE, up);
  }, [uid]);
  useEffect(() => {
    if (!online) return;
    api.get("/wizards/mine").then(({ data }) => {
      localStorage.setItem(doneKey(uid), JSON.stringify(data.finished));
      setDone(data.finished);
    }).catch(() => {});
  }, [uid, online]);
  return done;
}
