import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const QKEY = "mbp_shore_alert_q";
const HIDE_KEY = "mbp_shore_alert_hidden";
const readQ = () => { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch { return []; } };
const writeQ = (q) => localStorage.setItem(QKEY, JSON.stringify(q));
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-alert`);

// Mayday / Pan-Pan shore contact alert: held on the phone with its GPS fix until there's signal, then stood down from any phone aboard.
export default function useShoreAlert(entry, crew, online, gps) {
  const owner = crew ? entry.owner_id : "";
  const boatId = entry.boat_id;
  const mine = useCallback((j) => j.boat_id === boatId && j.owner_id === owner, [boatId, owner]);
  const [alert, setAlert] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [phase, setPhase] = useState(() => (readQ().some((j) => j.boat_id === boatId && j.owner_id === owner && j.type === "up") ? "queued" : ""));
  const [hidden, setHidden] = useState(() => { try { return JSON.parse(localStorage.getItem(HIDE_KEY) || "[]"); } catch { return []; } });
  const gpsRef = useRef(gps);
  gpsRef.current = gps;
  const flushing = useRef(false);

  const apply = (d) => { setContacts(d.contacts); setAlert(d.alert || null); };

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      for (const job of readQ().filter(mine)) {
        try {
          const { data } = await api.post(job.type === "down" ? "/shore/alert/stand-down" : "/shore/alert", job.body);
          apply(data);
          setPhase(job.type === "down" ? "cleared" : "");
        } catch (e) {
          if (!e.response || e.response.status >= 500) break;
          setPhase("");
        }
        writeQ(readQ().filter((j) => j.id !== job.id));
      }
    } finally { flushing.current = false; }
  }, [mine]);

  useEffect(() => {
    if (!online) return undefined;
    const tick = () => { flush().then(() => api.get("/shore/alert", { params: { owner_id: owner, boat_id: boatId } }).then(({ data }) => apply(data)).catch(() => {})); };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [online, owner, boatId, flush]);
  // A held alert goes the moment the phone gets signal back, even if the app is still in offline mode.
  useEffect(() => { window.addEventListener("online", flush); return () => window.removeEventListener("online", flush); }, [flush]);

  const raise = (kind) => {
    if (contacts === 0) return;
    if (alert?.state === "active" && (alert.kind === kind || alert.kind === "mayDay")) return;
    if (readQ().some((j) => mine(j) && j.type === "up" && j.body.kind === kind)) return;
    const g = gpsRef.current;
    const fix = g.status === "ok" ? { lat: g.lat, lon: g.lon, acc: g.acc, fix_at: Date.now() } : g.last?.lat != null ? { lat: g.last.lat, lon: g.last.lon, fix_at: g.last.at } : {};
    const body = { owner_id: owner, boat_id: boatId, alert_id: newId(), kind, at: Date.now(), ...fix };
    writeQ([...readQ(), { id: body.alert_id, type: "up", owner_id: owner, boat_id: boatId, body }]);
    setPhase(navigator.onLine ? "sending" : "queued");
    flush();
  };

  const standDown = () => {
    const held = readQ().filter((j) => mine(j) && j.type === "up");
    if (held.length && alert?.state !== "active") {
      const ids = new Set(held.map((j) => j.id));
      writeQ(readQ().filter((j) => !ids.has(j.id)));
      setPhase("cancelled");
      return;
    }
    if (alert?.state !== "active") return;
    writeQ([...readQ().filter((j) => !(mine(j) && j.type === "up")), { id: `down-${alert.alert_id}`, type: "down", owner_id: owner, boat_id: boatId, body: { owner_id: owner, boat_id: boatId, alert_id: alert.alert_id } }]);
    setPhase("clearing");
    flush();
  };

  const hide = (id) => { const next = [...hidden.filter((h) => h !== id), id].slice(-20); localStorage.setItem(HIDE_KEY, JSON.stringify(next)); setHidden(next); setPhase(""); };
  return { alert, contacts, phase, raise, standDown, hide, hidden, online };
}
