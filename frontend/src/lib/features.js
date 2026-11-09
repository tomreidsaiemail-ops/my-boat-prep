import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Features the admin has switched off for this user ("Admin - disabled features"); off until the server says otherwise.
const KEY = "mbp_disabled_features";
const DEFAULT = ["speak", "sync_stores"];
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || DEFAULT; } catch { return DEFAULT; } };
let current = null;
let inflight = null;
const subs = new Set();

const load = () => {
  inflight = inflight || api.get("/me/features").then(({ data }) => {
    current = data.disabled || [];
    localStorage.setItem(KEY, JSON.stringify(current));
    subs.forEach((f) => f(current));
  }).catch(() => { inflight = null; });
  return inflight;
};

export const useFeature = (key) => {
  const [off, setOff] = useState(() => current || read());
  useEffect(() => {
    subs.add(setOff);
    if (!current) load();
    return () => { subs.delete(setOff); };
  }, []);
  return !off.includes(key);
};
