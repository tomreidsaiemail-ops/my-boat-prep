import { LinkedText } from "@/components/boat/LinkedText";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Map as MapIcon, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { RotaList } from "@/components/boat/RotaList";
import { setPendingRsvp } from "@/lib/pendingAgreement";
import { DEFAULT_TRIP, openList } from "@/lib/trips";

const TripReply = ({ trip, many, busy, onReply }) => {
  const Btn = ({ status, icon: Icon, children, on }) => (
    <button type="button" onClick={() => onReply(trip, status)} disabled={!!busy} aria-pressed={trip.rsvp === status} data-testid={`voyage-rsvp-${status}-btn${trip.trip_id === DEFAULT_TRIP ? "" : `-${trip.trip_id}`}`}
      className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-md border-2 text-sm font-bold [transition:background-color_.15s,color_.15s] ${trip.rsvp === status ? on : "border-[var(--navy)] bg-white text-[var(--navy)]"}`}>
      {busy === `${trip.trip_id}:${status}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {children}
    </button>
  );
  return (
    <div className="flex flex-col gap-2" data-testid={`voyage-trip-${trip.trip_id}`}>
      {many && <button type="button" className="self-start text-left text-sm font-extrabold text-[var(--navy)] underline underline-offset-2" onClick={() => openList(trip.trip_id)} data-testid={`voyage-trip-link-${trip.trip_id}`}>{trip.name}</button>}
      {trip.notes && <p className="whitespace-pre-line text-sm leading-relaxed" data-testid={`voyage-notes-text${trip.trip_id === DEFAULT_TRIP ? "" : `-${trip.trip_id}`}`}><LinkedText text={trip.notes} testId="voyage-notes" /></p>}
      <div className="flex gap-2">
        <Btn status="in" icon={Check} on="border-emerald-700 bg-emerald-700 text-white">I&apos;m in</Btn>
        <Btn status="out" icon={X} on="border-[var(--red)] bg-[var(--red)] text-white">Can&apos;t make it</Btn>
      </div>
    </div>
  );
};

export const VoyageCard = ({ boat, online }) => {
  const { user } = useAuth();
  const [voyage, setVoyage] = useState(null);
  const [busy, setBusy] = useState("");
  const params = { owner_id: boat.owner_id, boat_id: boat.boat_id };

  useEffect(() => {
    setVoyage(null);
    if (!online) return;
    const load = () => api.get("/crew/voyage", { params, timeout: 10000 }).then(({ data }) => setVoyage(data)).catch(() => {});
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [online, boat.owner_id, boat.boat_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reply = async (trip, status) => {
    if (!online) { toast.error("Go online to reply to the skipper"); return false; }
    setBusy(`${trip.trip_id}:${status}`);
    try {
      await api.post("/crew/rsvp", { ...params, status, trip_id: trip.trip_id });
      setVoyage((v) => ({ ...v, trips: v.trips.map((t) => (t.trip_id === trip.trip_id ? { ...t, rsvp: status } : t)) }));
      toast.success(status === "in" ? "The skipper can see you're in" : "The skipper can see you can't make it");
      return true;
    } catch (e) { toast.error(apiError(e, "Couldn't send your reply, please try again")); return false; }
    finally { setBusy(""); }
  };
  // A trip shows when the skipper wrote notes for it, or the crew member was asked on a Route Planning copy; the watch rota shows on its own.
  const trips = (voyage?.trips || []).filter((t) => t.notes || t.trip_id !== DEFAULT_TRIP);
  const many = trips.length > 1 || trips.some((t) => t.trip_id !== DEFAULT_TRIP);
  const open = online ? trips.find((t) => !t.rsvp) : null;
  useEffect(() => { setPendingRsvp(open ? { name: many ? open.name : "", send: (status) => reply(open, status) } : null); return () => setPendingRsvp(null); }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trips.length && !voyage?.rota) return null;
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border-[1.5px] border-[var(--navy)] bg-white p-3.5" data-testid="voyage-card">
      <h2 className="flex items-center gap-2 font-display text-base font-extrabold uppercase tracking-tight"><MapIcon className="h-4 w-4" /> Planned voyage{many ? "s" : ""}</h2>
      {trips.map((t) => <TripReply key={t.trip_id} trip={t} many={many} busy={busy} onReply={reply} />)}
      {voyage.rota && (
        <div className="flex flex-col gap-1.5" data-testid="voyage-rota">
          <p className="field-label">Watch rota <span className="normal-case tracking-normal text-[var(--muted)]">· your watches are highlighted</span></p>
          <RotaList rota={voyage.rota} me={user?.user_id} testId="voyage-rota-list" />
        </div>
      )}
    </section>
  );
};
