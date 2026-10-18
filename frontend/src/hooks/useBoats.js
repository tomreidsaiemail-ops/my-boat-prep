import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { boatParams, claimDevice, outboxKey, stateKey } from "@/hooks/useBoatStore";
import { copyBoatState } from "@/lib/defaults";

const LIST_KEY = "mbp_boats";
const ACTIVE_KEY = "mbp_boats_active";
const MAIN = [{ key: "main", boat_id: "main", vessel: "" }];
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const unsynced = (key) => Number(localStorage.getItem(outboxKey(key)) || 0) > 0;
const isOnline = () => navigator.onLine && localStorage.getItem("mbp_manual_offline") !== "1";
export const boatKey = (b) => (b.crew ? `c_${b.owner_id}_${b.boat_id}` : b.boat_id);
const withKey = (b) => ({ ...b, key: b.key || boatKey(b), shared: !!b.crew || b.crew_count > 0 });

export default function useBoats(userId) {
  useState(() => claimDevice(userId));
  const [boats, setBoats] = useState(() => read(LIST_KEY, MAIN).map(withKey));
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || "main");
  const [online, setOnline] = useState(isOnline);
  const flushing = useRef(new Set());
  const firstFetch = useRef(true);
  const currentBoat = boats.find((b) => b.key === activeId) || boats[0];
  const current = currentBoat.key;

  useEffect(() => { localStorage.setItem(LIST_KEY, JSON.stringify(boats)); }, [boats]);
  useEffect(() => { localStorage.setItem(ACTIVE_KEY, activeId); }, [activeId]);
  useEffect(() => {
    const up = () => setOnline(isOnline());
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", up); };
  }, []);

  const refresh = useCallback(() => api.get("/me/boats", { timeout: 10000 }).then(({ data }) => {
    setBoats((local) => {
      const server = data.boats.map(withKey);
      const ids = new Set(server.map((b) => b.key));
      const localOnly = local.filter((b) => !b.crew && !ids.has(b.key) && unsynced(b.key));
      const merged = [...server, ...localOnly].map((b) => ({ ...b, vessel: read(stateKey(b.key), null)?.boat?.vessel ?? b.vessel }));
      return merged.length ? merged : MAIN;
    });
    // Open the boat this skipper last used, on whichever phone that was.
    if (firstFetch.current && data.last && data.boats.some((b) => boatKey(b) === data.last)) setActiveId(data.last);
    firstFetch.current = false;
  }).catch(() => {}), []);

  useEffect(() => { if (online) refresh(); }, [online, refresh]);

  // Changes made offline on a boat you've since switched away from still reach the cloud.
  useEffect(() => {
    if (!online) return;
    boats.filter((b) => b.key !== current && unsynced(b.key) && !flushing.current.has(b.key)).forEach((b) => {
      const st = read(stateKey(b.key), null);
      if (!st) return;
      flushing.current.add(b.key);
      api.put("/me/boat", st, { params: boatParams(b), timeout: 10000 })
        .then(() => localStorage.setItem(outboxKey(b.key), "0")).catch(() => {})
        .finally(() => flushing.current.delete(b.key));
    });
  }, [online, current, boats]);

  const select = useCallback((key) => {
    setActiveId(key);
    api.put("/me/last-boat", { key }).catch(() => {});
  }, []);

  const patch = useCallback((key, fields) => setBoats((list) => list.map((b) => (b.key === key ? { ...b, ...fields } : b))), []);
  const setVessel = useCallback((key, vessel) => patch(key, { vessel }), [patch]);

  const add = useCallback((fromState, vessel) => {
    const id = `b${Date.now().toString(36)}`;
    localStorage.setItem(stateKey(id), JSON.stringify(copyBoatState(fromState, vessel)));
    localStorage.setItem(outboxKey(id), "1");
    localStorage.setItem(`mbp_boat_new_${id}`, "1");
    setBoats((list) => [...list, withKey({ boat_id: id, vessel })]);
    select(id);
  }, [select]);

  const remove = useCallback(async (b) => {
    if (b.crew) await api.post("/crew/leave", { owner_id: b.owner_id, boat_id: b.boat_id }, { timeout: 10000 });
    else {
      // A boat added but not yet saved to the cloud only needs removing from this phone.
      try { await api.delete(`/me/boats/${b.boat_id}`, { timeout: 10000 }); } catch (e) { if (!(e.response?.status === 404 || (e.response?.status === 400 && unsynced(b.key)))) throw e; }
    }
    localStorage.removeItem(stateKey(b.key));
    localStorage.removeItem(outboxKey(b.key));
    setBoats((list) => list.filter((x) => x.key !== b.key));
  }, []);

  return { boats, activeId: current, current: currentBoat, select, setVessel, patch, add, remove, refresh };
}
