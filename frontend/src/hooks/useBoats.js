import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { claimDevice, outboxKey, stateKey } from "@/hooks/useBoatStore";
import { copyBoatState } from "@/lib/defaults";

const LIST_KEY = "mbp_boats";
const ACTIVE_KEY = "mbp_boats_active";
const MAIN = [{ boat_id: "main", vessel: "" }];
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const unsynced = (id) => Number(localStorage.getItem(outboxKey(id)) || 0) > 0;
const isOnline = () => navigator.onLine && localStorage.getItem("mbp_manual_offline") !== "1";

export default function useBoats(userId) {
  useState(() => claimDevice(userId));
  const [boats, setBoats] = useState(() => read(LIST_KEY, MAIN));
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || "main");
  const [online, setOnline] = useState(isOnline);
  const flushing = useRef(new Set());
  const current = boats.some((b) => b.boat_id === activeId) ? activeId : boats[0].boat_id;

  useEffect(() => { localStorage.setItem(LIST_KEY, JSON.stringify(boats)); }, [boats]);
  useEffect(() => { localStorage.setItem(ACTIVE_KEY, current); }, [current]);
  useEffect(() => {
    const up = () => setOnline(isOnline());
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", up); };
  }, []);

  useEffect(() => {
    if (!online) return;
    api.get("/me/boats", { timeout: 10000 }).then(({ data }) => setBoats((local) => {
      const ids = new Set(data.boats.map((b) => b.boat_id));
      const localOnly = local.filter((b) => !ids.has(b.boat_id) && unsynced(b.boat_id));
      const merged = [...data.boats, ...localOnly].map((b) => ({ ...b, vessel: read(stateKey(b.boat_id), null)?.boat?.vessel ?? b.vessel }));
      return merged.length ? merged : MAIN;
    })).catch(() => {});
  }, [online]);

  // Changes made offline on a boat you've since switched away from still reach the cloud.
  useEffect(() => {
    if (!online) return;
    boats.filter((b) => b.boat_id !== current && unsynced(b.boat_id) && !flushing.current.has(b.boat_id)).forEach((b) => {
      const st = read(stateKey(b.boat_id), null);
      if (!st) return;
      flushing.current.add(b.boat_id);
      api.put("/me/boat", st, { params: { boat_id: b.boat_id }, timeout: 10000 })
        .then(() => localStorage.setItem(outboxKey(b.boat_id), "0")).catch(() => {})
        .finally(() => flushing.current.delete(b.boat_id));
    });
  }, [online, current, boats]);

  const setVessel = useCallback((id, vessel) => setBoats((list) => list.map((b) => (b.boat_id === id ? { ...b, vessel } : b))), []);

  const add = useCallback((fromState, vessel) => {
    const id = `b${Date.now().toString(36)}`;
    localStorage.setItem(stateKey(id), JSON.stringify(copyBoatState(fromState, vessel)));
    localStorage.setItem(outboxKey(id), "1");
    localStorage.setItem(`mbp_boat_new_${id}`, "1");
    setBoats((list) => [...list, { boat_id: id, vessel }]);
    setActiveId(id);
  }, []);

  const remove = useCallback(async (id) => {
    // A boat added but not yet saved to the cloud only needs removing from this phone.
    try { await api.delete(`/me/boats/${id}`, { timeout: 10000 }); } catch (e) { if (!(e.response?.status === 404 || (e.response?.status === 400 && unsynced(id)))) throw e; }
    localStorage.removeItem(stateKey(id));
    localStorage.removeItem(outboxKey(id));
    setBoats((list) => list.filter((b) => b.boat_id !== id));
  }, []);

  return { boats, activeId: current, select: setActiveId, setVessel, add, remove };
}
