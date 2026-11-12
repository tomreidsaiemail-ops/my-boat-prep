import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Anchor, ListChecks, Loader2, LogOut, RefreshCw, Ship } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { useAuth } from "@/context/AuthContext";
import { ShoreMap } from "@/components/boat/shore/ShoreMap";
import { ShoreStatus } from "@/components/boat/shore/ShoreStatus";
import { ShoreAlertNotice } from "@/components/boat/shore/ShoreAlertNotice";
import { ShoreChooser } from "@/components/boat/shore/ShoreChooser";
import { ACTIVE_KEY } from "@/hooks/useBoats";
import { readPick, savePick } from "@/lib/shorePick";

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

// Shore Contact Monitoring: the watched boat's path this trip, where it is now, and whether it's online.
export default function ShoreWatch() {
  const { user, logout, refresh } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  const [boats, setBoats] = useState(null);
  const [pick, setPick] = useState(0);
  const [track, setTrack] = useState(null);
  const shoreHome = !!(user?.shore_only || user?.home === "shore" || user?.shore_contact);
  const [choosing, setChoosing] = useState(() => shoreHome && !readPick(user?.user_id));
  const boat = choosing ? null : boats?.[pick];
  const alertOn = (track?.alert || boat?.alert)?.state === "active";

  useEffect(() => { api.get("/shore/boats").then(({ data }) => setBoats(data.boats)).catch(() => setBoats([])); }, []);
  const load = () => boat && api.get("/shore/track", { params: { owner_id: boat.owner_id, boat_id: boat.boat_id } }).then(({ data }) => setTrack(data)).catch(() => {});
  useEffect(() => {
    setTrack(null);
    if (!boat) return undefined;
    load();
    const id = setInterval(load, (alertOn ? 15 : 60) * 1000);
    return () => clearInterval(id);
  }, [boat?.owner_id, boat?.boat_id, alertOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const toApp = async (key) => {
    try {
      if (user?.shore_only) await api.post("/shore/own-boat");
      else if (user?.home !== "shore") await api.put("/shore/home", { home: "app" });
      if (typeof key === "string") { localStorage.setItem(ACTIVE_KEY, key); await api.put("/me/last-boat", { key }); }
    } catch (e) { toast.error(apiError(e, "Couldn't open My Boat Prep, please try again")); return; }
    savePick(user.user_id, "app");
    await refresh();
    navigate("/", { replace: true });
  };
  const toShore = (i) => { savePick(user.user_id, "shore"); setPick(i); setChoosing(false); };
  const signOut = () => logout().then(() => navigate("/login"));
  const last = track?.points?.[track.points.length - 1];
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-5" data-testid="shore-watch-page">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">{choosing ? "Welcome back" : boat?.mine ? "Boat monitoring" : "Shore Contact"}</p>
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight" data-testid="shore-watch-vessel">{choosing ? "Where to?" : boat ? boat.vessel : "My Boat Prep"}</h1>
          {boat && !boat.mine && <p className="text-sm text-[var(--muted)]" data-testid="shore-watch-skipper">Skipper: {track?.skipper || boat.skipper}</p>}
        </div>
        <button type="button" className="icon-btn h-11 w-11 shrink-0" onClick={() => setLeaving(true)} aria-label="Leave or sign out" data-testid="shore-watch-signout"><LogOut className="h-5 w-5" /></button>
      </header>
      {choosing && <ShoreChooser shoreBoats={boats} onApp={toApp} onShore={toShore} />}
      {!choosing && boats === null && <Loader2 className="h-6 w-6 animate-spin" />}
      {!choosing && boats?.length === 0 && <p className="rounded-lg bg-slate-100 p-4 text-sm" data-testid="shore-watch-none">There's no boat to monitor yet. Shore contacts: open the invite link the skipper sent you, or sign in with the email it was sent to.</p>}
      {!choosing && boats?.length > 1 && (
        <label className="flex flex-col gap-1 text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">Vessel
          <select value={pick} onChange={(e) => setPick(Number(e.target.value))} className="field-input text-base normal-case tracking-normal text-[var(--ink)]" data-testid="shore-watch-boat-select">
            {boats.map((b, n) => <option key={`${b.owner_id}-${b.boat_id}`} value={n}>{b.alert ? `${b.alert.kind === "mayDay" ? "MAYDAY" : "PAN-PAN"}: ` : ""}{b.vessel} {b.mine ? "(yours)" : `(skipper ${b.skipper})`}</option>)}
          </select>
        </label>
      )}
      {boat && (
        <>
          <ShoreAlertNotice alert={track?.alert} me={user?.user_id} skipper={track?.skipper} phone={track?.skipper_phone} onSeen={boat.mine ? undefined : async (a) => {
            try { const { data } = await api.post("/shore/alert/seen", { owner_id: boat.owner_id, boat_id: boat.boat_id, alert_id: a.alert_id }); setTrack((t) => ({ ...t, alert: data.alert })); toast.success("The boat can see you've seen the alert"); }
            catch (e) { toast.error(apiError(e, "Couldn't tell the boat, please try again")); }
          }} />
          <ShoreStatus status={track?.status || boat.status} testId="shore-watch-status" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span data-testid="shore-watch-summary">
              {track?.started_at ? `Trip started ${when(track.started_at)}` : track?.arrived_at ? `Arrived safely ${when(track.arrived_at)}` : track?.ended_at ? `Last trip ended ${when(track.ended_at)}` : "No trip being tracked"}
              {last ? ` · now at ${last.lat.toFixed(4)}, ${last.lon.toFixed(4)}` : ""}
            </span>
            <button type="button" className="btn-ghost min-h-10 gap-2 px-3 text-sm" onClick={load} data-testid="shore-watch-refresh"><RefreshCw className="h-4 w-4" /> Refresh</button>
          </div>
          {track && (track.points.length > 0 || alertOn) ? <ShoreMap points={track.points} alert={track.alert} /> : (
            <p className="rounded-lg bg-slate-100 p-4 text-sm" data-testid="shore-watch-no-points">No positions yet for this trip. They appear when the skipper turns on sharing and the app is open on a phone aboard.</p>
          )}
          <p className="text-xs text-[var(--muted)]">Updates every minute. Positions are sent every 1 km, or hourly when anchored, while My Boat Prep is open aboard. Offline means the hourly check-in was missed; you'll also get an email after two missed check-ins.</p>
        </>
      )}
      {!choosing && shoreHome && <button type="button" className="btn-ghost mt-2 min-h-11 justify-center gap-2" onClick={() => setChoosing(true)} data-testid="shore-watch-choose-boat"><ListChecks className="h-4 w-4" /> Choose another boat</button>}
      {!choosing && (user?.shore_only
        ? <button type="button" className="btn-solid min-h-11 justify-center gap-2" onClick={toApp} data-testid="shore-watch-own-boat"><Ship className="h-4 w-4" /> Add my own boat on My Boat Prep</button>
        : <button type="button" className="btn-ghost min-h-11 justify-center gap-2" onClick={toApp} data-testid="shore-watch-open-app"><Anchor className="h-4 w-4" /> My boats</button>)}
      <ConfirmDelete item={leaving ? {} : null} testId="shore-leave" danger={false} title="Leave the shore contact map?"
        note={user?.shore_only ? "Set up your own boat on My Boat Prep, or sign out. You'll still be this boat's shore contact either way." : "Go to your boats, or sign out. The map stays in your account menu under Shore contact map."}
        confirmLabel="Sign out" cancelLabel="Stay on the map" onConfirm={signOut} onClose={() => setLeaving(false)}
        body={<button type="button" className="btn-solid min-h-11 justify-center gap-2" onClick={() => { setLeaving(false); toApp(); }} data-testid="shore-leave-own-boat-btn">
          {user?.shore_only ? <><Ship className="h-4 w-4" /> Add my own boat on My Boat Prep</> : <><Anchor className="h-4 w-4" /> Go to my boats</>}</button>} />
      <p className="text-center text-xs text-[var(--muted)]">Signed in as {user?.email}</p>
    </main>
  );
}
