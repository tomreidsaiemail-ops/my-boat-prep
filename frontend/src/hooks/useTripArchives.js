import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { openList } from "@/lib/trips";
import { archivePayload, finishedTrip, resetTrip, restoreTarget, restoreTrip, snoozeTrip } from "@/lib/tripArchive";

// Archived trips for the skipper's boat: the finished-trip prompt, archive + Undo, restore and delete.
export default function useTripArchives({ boat, state, mutate, online, enabled }) {
  const [archives, setArchives] = useState(null);
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const asked = useRef("");
  const base = `/boats/${boat.boat_id}/trip-archives`;

  useEffect(() => {
    setArchives(null);
    if (enabled && online) api.get(base).then(({ data }) => setArchives(data.archives)).catch(() => setArchives([]));
  }, [base, enabled, online]);

  useEffect(() => {
    if (!enabled || !online || asked.current === boat.key) return;
    asked.current = boat.key;
    const t = finishedTrip(stateRef.current, boat.key);
    if (t) setAsk({ id: t.id, name: t.name, finish: t.finish });
  }, [enabled, online, boat.key]);

  const restore = async (a) => {
    const to = restoreTarget(stateRef.current, a);
    try {
      const { data } = await api.post(`${base}/${a.archive_id}/restore`, { to_trip_id: to.id });
      mutate((s) => restoreTrip(s, data, to));
      setArchives((l) => (l || []).filter((x) => x.archive_id !== a.archive_id));
      toast.dismiss(a.archive_id);
      toast.success(to.add && to.id !== a.trip_id ? `Restored as ${to.name}, so your current trip isn't touched` : `${to.name} is back as an active trip`);
      openList(to.id);
      return true;
    } catch (e) {
      toast.error(apiError(e, "Couldn't restore that trip, please try again"));
      return false;
    }
  };

  const archive = async (id, mail = {}) => {
    if (!online) { toast.error("Archiving a trip needs a signal"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(base, { ...archivePayload(stateRef.current, id), email_shore: mail.shore !== false, email_crew: mail.crew !== false });
      mutate((s) => resetTrip(s, id));
      setArchives((l) => [data, ...(l || [])]);
      toast.success(`${data.name} archived. The wrap-up email goes out in 3 minutes unless you Undo`, { id: data.archive_id, duration: 10000, action: { label: "Undo", onClick: () => restore(data) } });
    } catch (e) {
      toast.error(apiError(e, "Couldn't archive the trip, please try again"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    try {
      await api.delete(`${base}/${a.archive_id}`);
      setArchives((l) => (l || []).filter((x) => x.archive_id !== a.archive_id));
      toast.dismiss(a.archive_id);
      toast.success(`${a.name} archive deleted`);
    } catch (e) {
      toast.error(apiError(e, "Couldn't delete that archive"));
    }
  };

  const askArchive = (id, name) => setAsk({ id, name, manual: true });
  const setMail = (k, v) => setAsk((a) => (a ? { ...a, mail: { shore: true, crew: true, ...(a.mail || {}), [k]: v } } : a));
  const closeAsk = () => { if (ask && !ask.manual) snoozeTrip(boat.key, ask.id); setAsk(null); };
  const confirmAsk = () => { const { id, mail } = ask; setAsk(null); archive(id, mail); };

  return { archives, ask, busy, askArchive, closeAsk, confirmAsk, setMail, restore, remove, load: (id) => api.get(`${base}/${id}`).then(({ data }) => data) };
}
