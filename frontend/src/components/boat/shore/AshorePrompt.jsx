import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

const SNOOZE = "mbp_ashore_snooze";
const HOUR = 60 * 60 * 1000;
const all = () => { try { return JSON.parse(localStorage.getItem(SNOOZE) || "{}"); } catch { return {}; } };
const snoozed = (key) => (all()[key] || 0) > Date.now();
const snooze = (key, ms) => localStorage.setItem(SNOOZE, JSON.stringify(Object.fromEntries([...Object.entries(all()).filter(([, t]) => t > Date.now()), [key, Date.now() + ms]])));
const time = (iso) => new Date(iso).toLocaleString("en-NZ", { weekday: "short", hour: "2-digit", minute: "2-digit" });

// The skipper is asked if they've arrived when the boat stops (once per stop) or after an hour ashore, so shore contacts aren't left wondering.
export const AshorePrompt = ({ boat, tracking, stopAt, online }) => {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60 * 1000); return () => clearInterval(id); }, []);
  const since = tracking?.on ? tracking.ashore_since : null;
  const trip = tracking?.trip_id;
  const stopKey = stopAt ? `${trip}|stop|${stopAt}` : "";
  const ashore = !!since && now - new Date(since).getTime() >= HOUR && !snoozed(trip);
  const stopped = !!stopAt && tracking?.on && !snoozed(stopKey);
  const show = (ashore || stopped) && online && !boat?.crew;
  const arrived = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/shore/arrived`);
      window.dispatchEvent(new CustomEvent("mbp:tracking", { detail: { boat_id: boat.boat_id, tracking: { on: false, trip_id: data.trip_id } } }));
      toast.success(data.told ? `Trip finished. Told ${data.told} shore ${data.told === 1 ? "contact" : "contacts"} you arrived safely.` : "Trip finished.");
    } catch (e) { toast.error(apiError(e, "Couldn't finish the trip")); }
    setBusy(false);
  };
  const notYet = () => {
    if (stopped) snooze(stopKey, 24 * HOUR);
    if (ashore) snooze(trip, HOUR);
    setNow(Date.now());
  };
  const note = ashore
    ? `Your boat has been ashore since ${time(since)}. Tap Arrived to end tracking and tell your shore contacts you arrived safely.`
    : `Your boat stopped here at ${stopAt ? time(new Date(stopAt).toISOString()) : "a few minutes ago"}, and your shore contacts have this position. If you've arrived, tap Arrived to end tracking and tell them you arrived safely.`;
  return (
    <ConfirmDelete item={show && !busy ? {} : null} testId="ashore-prompt" danger={false} title="Arrived?" note={note}
      confirmLabel="Arrived" cancelLabel="Not yet" onConfirm={arrived} onClose={notYet} />
  );
};
