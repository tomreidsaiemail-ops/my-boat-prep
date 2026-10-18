import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { applyTemplates, freshState, migrateState } from "@/lib/defaults";

const STATE_KEY = "mbp_state_v3";
const OUTBOX_KEY = "mbp_outbox_v3";
const OWNER_KEY = "mbp_owner";
const MANUAL_OFFLINE_KEY = "mbp_manual_offline";

// Local data belongs to one account: a different sign-in on this phone starts from its own cloud copy.
const claimLocal = (userId) => {
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner && owner !== userId) {
    localStorage.removeItem(STATE_KEY);
    localStorage.setItem(OUTBOX_KEY, "0");
  }
  localStorage.setItem(OWNER_KEY, userId);
  return userId;
};

const loadLocal = () => {
  try { return migrateState(JSON.parse(localStorage.getItem(STATE_KEY))); } catch { return null; }
};

export default function useBoatStore(userId) {
  const ownerId = useRef(null);
  if (ownerId.current === null) ownerId.current = claimLocal(userId);
  const hadLocal = useRef(!!loadLocal());
  const [state, setState] = useState(() => loadLocal() || freshState());
  const [pending, setPending] = useState(() => Number(localStorage.getItem(OUTBOX_KEY) || 0));
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [reachable, setReachable] = useState(true);
  const [manualOffline, setManualOffline] = useState(() => localStorage.getItem(MANUAL_OFFLINE_KEY) === "1");
  const queuedOffline = useRef(pending > 0);
  const stateRef = useRef(state);
  const pendingRef = useRef(pending);
  stateRef.current = state;
  pendingRef.current = pending;
  const online = browserOnline && reachable && !manualOffline;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { localStorage.setItem(OUTBOX_KEY, String(pending)); }, [pending]);
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
    api.get("/me/boat").then(({ data }) => {
      if (pendingRef.current > 0) return;
      if (!hadLocal.current || data.updated_at > stateRef.current.updated_at) {
        const m = migrateState(data);
        setState({ boat: data.boat, registry: m.registry, data: m.data, updated_at: data.updated_at, log_sent: data.log_sent || null, engine_log: data.engine_log || [], deleted_lists: m.deleted_lists, emergency_checked: data.emergency_checked || {} });
      }
    }).catch((e) => {
      if (e.response?.status !== 404) { if (!e.response) setReachable(false); return; }
      setPending((p) => Math.max(p, 1));
      // Brand-new skipper: start the built-in lists from the admin's master templates.
      if (!hadLocal.current) api.get("/templates").then(({ data }) => mutate((s) => applyTemplates(s, data.templates))).catch(() => {});
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pending === 0 || !online) return undefined;
    const timer = setTimeout(async () => {
      const sent = pendingRef.current;
      try {
        await api.put("/me/boat", stateRef.current, { timeout: 10000 });
        setPending((p) => Math.max(0, p - sent));
        if (queuedOffline.current) {
          queuedOffline.current = false;
          toast.success("Changes successfully synchronized to cloud database");
        }
      } catch (e) {
        if (e.response?.status !== 401) setReachable(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [pending, online, state]);

  useEffect(() => {
    if (reachable || !browserOnline) return undefined;
    const retry = setInterval(() => setReachable(true), 15000);
    return () => clearInterval(retry);
  }, [reachable, browserOnline]);

  const mutate = useCallback((fn, { count = true } = {}) => {
    setState((prev) => ({ ...fn(prev), updated_at: new Date().toISOString() }));
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
    await api.put("/me/boat", { ...cur, boat: { ...cur.boat, log_email: email } }, { timeout: 10000 });
    setPending((p) => Math.max(0, p - sent));
    const { data } = await api.post("/me/email-log", { local_date: localDate, list_ids: listIds, position }, { timeout: 40000 });
    if (listIds.length === 1 && listIds[0] === "shipsLog") mutate((s) => ({ ...s, log_sent: data.log_sent }), { count: false });
    return data.log_sent;
  }, [mutate]);

  return { state, mutate, pending, online, goOffline, goOnline, emailLog };
}
