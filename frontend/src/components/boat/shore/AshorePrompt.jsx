import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

const SNOOZE = "mbp_ashore_snooze";
const HOUR = 60 * 60 * 1000;
const snoozed = (trip) => { try { return (JSON.parse(localStorage.getItem(SNOOZE) || "{}")[trip] || 0) > Date.now(); } catch { return false; } };
const snooze = (trip) => localStorage.setItem(SNOOZE, JSON.stringify({ [trip]: Date.now() + HOUR }));

// After an hour ashore the skipper is asked if they've arrived, so shore contacts aren't left wondering.
export const AshorePrompt = ({ boat, tracking, online }) => {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60 * 1000); return () => clearInterval(id); }, []);
  const since = tracking?.on ? tracking.ashore_since : null;
  const trip = tracking?.trip_id;
  const show = !!since && online && !boat?.crew && now - new Date(since).getTime() >= HOUR && !snoozed(trip);
  const arrived = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/shore/arrived`);
      window.dispatchEvent(new CustomEvent("mbp:tracking", { detail: { boat_id: boat.boat_id, tracking: { on: false, trip_id: data.trip_id } } }));
      toast.success(data.told ? `Trip finished. Told ${data.told} shore ${data.told === 1 ? "contact" : "contacts"} you arrived safely.` : "Trip finished.");
    } catch (e) { toast.error(apiError(e, "Couldn't finish the trip")); }
    setBusy(false);
  };
  return (
    <ConfirmDelete item={show && !busy ? {} : null} testId="ashore-prompt" danger={false} title="Arrived?"
      note={`Your boat has been ashore since ${since ? new Date(since).toLocaleString("en-NZ", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "over an hour ago"}. Tap Arrived to end tracking and tell your shore contacts you arrived safely.`}
      confirmLabel="Arrived" cancelLabel="Not yet" onConfirm={arrived} onClose={() => { snooze(trip); setNow(Date.now()); }} />
  );
};
