import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { freshState } from "@/lib/defaults";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATE_KEY = "mbp_state_v3";
const OUTBOX_KEY = "mbp_outbox_v3";
const DEVICE_KEY = "mbp_device_id";
const MANUAL_OFFLINE_KEY = "mbp_manual_offline";

const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9-]/g, "");
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
};

const loadLocal = () => {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)); } catch { return null; }
};

export default function useBoatStore() {
  const deviceId = useRef(getDeviceId()).current;
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
    axios.get(`${API}/boats/${deviceId}`).then(({ data }) => {
      if (pendingRef.current > 0) return;
      if (!hadLocal.current || data.updated_at > stateRef.current.updated_at) {
        setState({ boat: data.boat, registry: data.registry, data: data.data, updated_at: data.updated_at });
      }
    }).catch((e) => {
      if (e.response?.status === 404) setPending((p) => Math.max(p, 1));
      else if (!e.response) setReachable(false);
    });
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pending === 0 || !online) return undefined;
    const timer = setTimeout(async () => {
      const sent = pendingRef.current;
      try {
        await axios.put(`${API}/boats/${deviceId}`, stateRef.current, { timeout: 10000 });
        setPending((p) => Math.max(0, p - sent));
        if (queuedOffline.current) {
          queuedOffline.current = false;
          toast.success("Changes successfully synchronized to cloud database");
        }
      } catch {
        setReachable(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [pending, online, deviceId, state]);

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

  return { state, mutate, pending, online, goOffline, goOnline };
}
