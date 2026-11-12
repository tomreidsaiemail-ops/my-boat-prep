import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Anchor, Loader2, LogOut, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ShoreMap } from "@/components/boat/shore/ShoreMap";
import { ShoreStatus } from "@/components/boat/shore/ShoreStatus";
import { ShoreAlertNotice } from "@/components/boat/shore/ShoreAlertNotice";

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

// Shore Contact Monitoring: the watched boat's path this trip, where it is now, and whether it's online.
export default function ShoreWatch() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boats, setBoats] = useState(null);
  const [pick, setPick] = useState(0);
  const [track, setTrack] = useState(null);
  const boat = boats?.[pick];
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

  const toApp = async () => { await api.put("/shore/home", { home: "app" }).catch(() => {}); window.location.assign("/"); };
  const last = track?.points?.[track.points.length - 1];
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-5" data-testid="shore-watch-page">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">{boat?.mine ? "Boat monitoring" : "Shore Contact"}</p>
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight" data-testid="shore-watch-vessel">{boat ? boat.vessel : "My Boat Prep"}</h1>
          {boat && !boat.mine && <p className="text-sm text-[var(--muted)]" data-testid="shore-watch-skipper">Skipper: {boat.skipper}</p>}
        </div>
        <button type="button" className="icon-btn h-11 w-11 shrink-0" onClick={() => logout().then(() => navigate("/login"))} aria-label="Sign out" data-testid="shore-watch-signout"><LogOut className="h-5 w-5" /></button>
      </header>
      {boats === null && <Loader2 className="h-6 w-6 animate-spin" />}
      {boats?.length === 0 && <p className="rounded-lg bg-slate-100 p-4 text-sm" data-testid="shore-watch-none">There's no boat to monitor yet. Shore contacts: open the invite link the skipper sent you, or sign in with the email it was sent to.</p>}
      {boats?.length > 1 && (
        <label className="flex flex-col gap-1 text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">Vessel
          <select value={pick} onChange={(e) => setPick(Number(e.target.value))} className="field-input text-base normal-case tracking-normal text-[var(--ink)]" data-testid="shore-watch-boat-select">
            {boats.map((b, n) => <option key={`${b.owner_id}-${b.boat_id}`} value={n}>{b.alert ? `${b.alert.kind === "mayDay" ? "MAYDAY" : "PAN-PAN"}: ` : ""}{b.vessel} {b.mine ? "(yours)" : `(skipper ${b.skipper})`}</option>)}
          </select>
        </label>
      )}
      {boat && (
        <>
          <ShoreAlertNotice alert={track?.alert || boat.alert} />
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
      {!user?.shore_only && <button type="button" className="btn-ghost mt-2 min-h-11 justify-center gap-2" onClick={toApp} data-testid="shore-watch-open-app"><Anchor className="h-4 w-4" /> My boats</button>}
      <p className="text-center text-xs text-[var(--muted)]">Signed in as {user?.email}</p>
    </main>
  );
}
