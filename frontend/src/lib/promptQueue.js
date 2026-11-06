import { useEffect, useState } from "react";

// Pop-ups that open by themselves wait their turn: boat invite, then Terms agreement, then crew registration.
const held = new Set();
const EVT = "mbp:prompts";

export const holdPrompt = (id, on) => {
  if (on) held.add(id); else held.delete(id);
  window.dispatchEvent(new Event(EVT));
};

export const usePromptsFree = (blockers) => {
  const key = blockers.join(",");
  const check = () => !key.split(",").some((b) => held.has(b));
  const [free, setFree] = useState(check);
  useEffect(() => {
    const f = () => setFree(check());
    f();
    window.addEventListener(EVT, f);
    return () => window.removeEventListener(EVT, f);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return free;
};
