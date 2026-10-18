import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { applyTemplates, freshState, migrateState, stamp } from "@/lib/defaults";

const STATE_KEY = "mbp_state_v3";
const OUTBOX_KEY = "mbp_outbox_v3";
const OWNER_KEY = "mbp_owner";
// The first boat keeps the original keys so existing phones carry straight on.
export const stateKey = (boatId) => (boatId === "main" ? STATE_KEY : `${STATE_KEY}_${boatId}`);
export const outboxKey = (boatId) => (boatId === "main" ? OUTBOX_KEY : `${OUTBOX_KEY}_${boatId}`);
const MANUAL_OFFLINE_KEY = "mbp_manual_offline";

// Local data belongs to one account: a different sign-in on this phone starts from its own cloud copy.
const claimLocal = (userId) => {
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner && owner !== userId) {
    Object.keys(localStorage).filter((k) => k.startsWith(STATE_KEY) || k.startsWith(OUTBOX_KEY) || k.startsWith("mbp_boat")).forEach((k) => localStorage.removeItem(k));
  }
  localStorage.setItem(OWNER_KEY, userId);
  return userId;
};

export const claimDevice = claimLocal;

const loadLocal = (boatId) => {
  try { return migrateState(JSON.parse(localStorage.getItem(stateKey(boatId)))); } catch { return null; }
};

export const serverToState = (data) => {
  const m = migrateState(data);
  return { boat: data.boat, registry: m.registry, data: m.data, updated_at: data.updated_at, log_sent: data.log_sent || null, engine_log: data.engine_log || [],
    deleted_lists: m.deleted_lists, emergency_checked: data.emergency_checked || {}, template_versions: data.template_versions || {},
    sec_ts: data.sec_ts || {}, list_ts: data.list_ts || {} };
};

const POLL_MS = 20000;

export const boatParams = (b) => (b.owner_id ? { boat_id: b.boat_id, owner: b.owner_id } : { boat_id: b.boat_id });

export default function useBoatStore(userId, boatEntry) {
  const boatId = boatEntry.key;
  const params = boatParams(boatEntry);
  const ownerId = useRef(null);
  if (ownerId.current === null) ownerId.current = claimLocal(userId);
  const hadLocal = useRef(!!loadLocal(boatId));
  const [state, setState] = useState(() => loadLocal(boatId) || freshState());
  const [role, setRole] = useState(boatEntry.crew ? "crew" : "owner");
  const [pending, setPending] = useState(() => Number(localStorage.getItem(outboxKey(boatId)) || 0));
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [reachable, setReachable] = useState(true);
  const [manualOffline, setManualOffline] = useState(() => localStorage.getItem(MANUAL_OFFLINE_KEY) === "1");
  const newBoatKey = `mbp_boat_new_${boatId}`;
  const queuedOffline = useRef(pending > 0 && !localStorage.getItem(newBoatKey));
  const stateRef = useRef(state);
  const pendingRef = useRef(pending);
  stateRef.current = state;
  pendingRef.current = pending;
  const online = browserOnline && reachable && !manualOffline;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => { localStorage.setItem(stateKey(boatId), JSON.stringify(state)); }, [state, boatId]);
  useEffect(() => { localStorage.setItem(outboxKey(boatId), String(pending)); }, [pending, boatId]);
  useEffect(() => { localStorage.setItem(MANUAL_OFFLINE_KEY, manualOffline ? "1" : "0"); }, [manualOffline]);

  useEffect(() => {
    const up = () => { setBrowserOnline(true); setReachable(true); };
    const down = () => setBrowserOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => {
    if (!navigator.onLine || manualOffline || pendingRef.current > 0) return;
    api.get("/me/boat", { params }).then(({ data }) => {
      setRole(data.role || "owner");
      if (pendingRef.current > 0) return;
      if (!hadLocal.current || data.updated_at > stateRef.current.updated_at) setState(serverToState(data));
    }).catch((e) => {
      if (e.response?.status !== 404) { if (!e.response) setReachable(false); return; }
      setPending((p) => Math.max(p, 1));
      // Brand-new skipper: start the built-in lists from the admin's master templates.
      if (!hadLocal.current && boatId === "main") api.get("/templates").then(({ data }) => mutate((s) => applyTemplates(s, data.templates))).catch(() => {});
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pending === 0 || !online) return undefined;
    const timer = setTimeout(async () => {
      const sent = pendingRef.current;
      try {
        const { data } = await api.put("/me/boat", stateRef.current, { timeout: 10000, params });
        // Take the cloud's merged copy (it may include other phones' changes) unless more edits were made meanwhile.
        if (pendingRef.current === sent) setState(serverToState(data));
        setPending((p) => Math.max(0, p - sent));
        localStorage.removeItem(newBoatKey);
        if (queuedOffline.current) {
          queuedOffline.current = false;
          toast.success("Changes successfully synchronized to cloud database");
        }
      } catch (e) {
        if (e.response?.status !== 401) setReachable(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [pending, online, state, boatId, newBoatKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared boats: pick up the crew's or skipper's ticks from other phones.
  useEffect(() => {
    if (!online || !boatEntry.shared) return undefined;
    const poll = setInterval(() => {
      if (document.visibilityState !== "visible" || pendingRef.current > 0) return;
      api.get("/me/boat", { params, timeout: 10000 }).then(({ data }) => {
        if (pendingRef.current === 0 && data.updated_at > stateRef.current.updated_at) setState(serverToState(data));
      }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [online, boatEntry.shared]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reachable || !browserOnline) return undefined;
    const retry = setInterval(() => setReachable(true), 15000);
    return () => clearInterval(retry);
  }, [reachable, browserOnline]);

  const mutate = useCallback((fn, { count = true } = {}) => {
    setState((prev) => { const now = new Date().toISOString(); return { ...stamp(prev, fn(prev), now), updated_at: now }; });
    setPending((p) => (count ? p + 1 : Math.max(p, 1)));
    if (!onlineRef.current) queuedOffline.current = true;
  }, []);

  const goOffline = useCallback(() => setManualOffline(true), []);
  const goOnline = useCallback(() => {
    if (!navigator.onLine) return false;
    setManualOffline(false);
    setReachable(true);
    return true;
  }, []);

  const emailLog = useCallback(async ({ localDate, listIds, position, email }) => {
    const sent = pendingRef.current;
    const cur = stateRef.current;
    await api.put("/me/boat", { ...cur, boat: { ...cur.boat, log_email: email } }, { timeout: 10000, params });
    setPending((p) => Math.max(0, p - sent));
    const { data } = await api.post("/me/email-log", { local_date: localDate, list_ids: listIds, position, boat_id: boatId }, { timeout: 40000 });
    if (listIds.length === 1 && listIds[0] === "shipsLog") mutate((s) => ({ ...s, log_sent: data.log_sent }), { count: false });
    return data.log_sent;
  }, [mutate, boatId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { state, mutate, pending, online, goOffline, goOnline, emailLog, crew: role === "crew" };
}
