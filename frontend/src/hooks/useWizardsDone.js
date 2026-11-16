import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const DONE = "mbp-wizard-done";
const doneKey = (uid) => `mbp_wizards_done:${uid}`;
const read = (uid) => { try { return JSON.parse(localStorage.getItem(doneKey(uid))) || []; } catch { return []; } };

// Opened / finished a Model Vessel walkthrough: counted for Analytics, and finished ones get a tick in Help.
export const wizardEvent = (uid, wizard, event) => {
  if (event === "finish") {
    localStorage.setItem(doneKey(uid), JSON.stringify([...new Set([...read(uid), wizard])]));
    window.dispatchEvent(new Event(DONE));
  }
  api.post("/wizards/event", { wizard, event }).catch(() => {});
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
