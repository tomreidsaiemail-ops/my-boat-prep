import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Features the admin has switched off for the signed-in user ("Admin - disabled features"); off until the server says otherwise.
// Kept per user so signing in as someone else never shows the last person's switches.
const DEFAULT = ["charter", "speak", "sync_stores"];
const KEY = (uid) => `mbp_disabled_features:${uid}`;
const read = (uid) => { try { return JSON.parse(localStorage.getItem(KEY(uid))) || DEFAULT; } catch { return DEFAULT; } };
const cache = {};
const inflight = {};
const fetchedAt = {};
const subs = new Set();

const load = (uid) => {
  inflight[uid] = inflight[uid] || api.get("/me/features").then(({ data }) => {
    cache[uid] = data.disabled || [];
    fetchedAt[uid] = Date.now();
    localStorage.setItem(KEY(uid), JSON.stringify(cache[uid]));
    subs.forEach((f) => f(uid, cache[uid]));
  }).catch(() => {}).finally(() => { delete inflight[uid]; });
  return inflight[uid];
};

export const useFeature = (key) => {
  const uid = useAuth()?.user?.user_id || "";
  const [state, setState] = useState(() => ({ uid, off: cache[uid] || read(uid) }));
  useEffect(() => {
    if (!uid) return undefined;
    setState({ uid, off: cache[uid] || read(uid) });
    const sub = (u, off) => { if (u === uid) setState({ uid, off }); };
    // Pick up admin changes when the app comes back to the front (at most once a minute).
    const onShow = () => { if (document.visibilityState === "visible" && Date.now() - (fetchedAt[uid] || 0) > 60000) load(uid); };
    subs.add(sub);
    document.addEventListener("visibilitychange", onShow);
    if (!cache[uid]) load(uid);
    return () => { subs.delete(sub); document.removeEventListener("visibilitychange", onShow); };
  }, [uid]);
  const off = state.uid === uid ? state.off : cache[uid] || read(uid);
  return !off.includes(key);
};
