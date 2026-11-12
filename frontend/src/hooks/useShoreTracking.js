import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// Shore Contact tracking from a phone aboard: a position every 1 km moved, or an hourly ping when stationary.
// Positions queue on the phone while offline and are sent when the signal comes back.
const QUEUE = "mbp_track_queue";
const LAST = "mbp_track_last";
const MOVE_M = 1000;
const PING_MS = 60 * 60 * 1000;
export const AWAKE_KEY = "mbp_track_awake";

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const metres = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

// One send at a time; a call while sending waits for that send instead of posting the same points again.
let sending = null;
const flush = () => {
  if (!sending) sending = sendQueue().finally(() => { sending = null; });
  return sending;
};
const sendQueue = async () => {
  const q = read(QUEUE, []);
  if (!q.length) return null;
  const groups = q.reduce((m, p) => m.set(`${p.owner_id}|${p.boat_id}|${p.trip_id}`, [...(m.get(`${p.owner_id}|${p.boat_id}|${p.trip_id}`) || []), p]), new Map());
  let tracking = null;
  for (const [key, pts] of groups) {
    const [owner_id, boat_id, trip_id] = key.split("|");
    for (let k = 0; k < pts.length; k += 500) {
      const batch = pts.slice(k, k + 500);
      try {
        const { data } = await api.post("/track/points", { owner_id, boat_id, trip_id, points: batch.map(({ lat, lon, at, acc, kind }) => ({ lat, lon, at, acc, kind })) });
        tracking = data.tracking;
        const sent = new Set(batch.map((p) => `${key}|${p.at}`));
        write(QUEUE, read(QUEUE, []).filter((p) => !sent.has(`${p.owner_id}|${p.boat_id}|${p.trip_id}|${p.at}`)));
      } catch (e) {
        if (e.response?.status === 404 || e.response?.status === 422) {
          write(QUEUE, read(QUEUE, []).filter((p) => `${p.owner_id}|${p.boat_id}|${p.trip_id}` !== key));
        }
        return tracking;
      }
    }
  }
  return tracking;
};

export default function useShoreTracking(boat, gps, online) {
  // The skipper's switch or the server's reply can change tracking before the boat list refreshes.
  const [override, setOverride] = useState(null);
  const key = boat ? `${boat.owner_id || ""}|${boat.boat_id}` : "";
  useEffect(() => {
    const on = (e) => { if (!boat?.crew && e.detail.boat_id === boat?.boat_id) setOverride({ key, tracking: e.detail.tracking }); };
    window.addEventListener("mbp:tracking", on);
    return () => window.removeEventListener("mbp:tracking", on);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const tracking = override?.key === key ? override.tracking : boat?.tracking;
  const on = !!tracking?.on && !!tracking?.trip_id && !boat?.charter_lock;
  const owner = boat?.crew ? boat.owner_id : "";
  const trip = tracking?.trip_id;
  const send = () => flush().then((t) => {
    if (t && ["on", "trip_id", "ashore_since", "relayed", "last_at"].some((k) => t[k] !== tracking?.[k])) setOverride({ key, tracking: t });
  });
  const fix = useRef(null);
  if (gps.status === "ok") fix.current = { lat: gps.lat, lon: gps.lon, acc: gps.acc };

  const add = (kind) => {
    if (!fix.current) return;
    const point = { ...fix.current, at: Date.now(), kind, owner_id: owner, boat_id: boat.boat_id, trip_id: trip };
    write(QUEUE, [...read(QUEUE, []), point].slice(-5000));
    write(LAST, { trip, lat: point.lat, lon: point.lon, at: point.at });
    if (navigator.onLine) send();
  };

  // A new position: send it at the start of the trip and after every 1 km moved.
  useEffect(() => {
    if (!on || gps.status !== "ok") return;
    const last = read(LAST, null);
    if (!last || last.trip !== trip) add("start");
    else if (metres(last, fix.current) >= MOVE_M) add("move");
  }, [on, trip, gps.lat, gps.lon, gps.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hourly heartbeat while stationary, and send anything queued once back online.
  useEffect(() => {
    if (!on) return undefined;
    const tick = () => {
      const last = read(LAST, null);
      if (last?.trip === trip && Date.now() - last.at >= PING_MS) add("ping");
      if (navigator.onLine) send();
    };
    tick();
    const id = setInterval(tick, 60 * 1000);
    window.addEventListener("online", tick);
    return () => { clearInterval(id); window.removeEventListener("online", tick); };
  }, [on, trip]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (online && boat) send(); }, [online, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Optional: keep the screen awake while tracking, so the phone doesn't pause the app.
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return undefined;
    let lock = null;
    const grab = () => {
      if (!read(AWAKE_KEY, false)) { lock?.release().catch(() => {}); lock = null; return; }
      if (document.visibilityState === "visible" && !lock) navigator.wakeLock.request("screen").then((l) => { lock = l; l.addEventListener("release", () => { lock = null; }); }).catch(() => {});
    };
    grab();
    document.addEventListener("visibilitychange", grab);
    window.addEventListener("mbp:track-awake", grab);
    return () => { document.removeEventListener("visibilitychange", grab); window.removeEventListener("mbp:track-awake", grab); lock?.release().catch(() => {}); };
  }, [on]);

  return { on, tracking, queued: read(QUEUE, []).length };
}
