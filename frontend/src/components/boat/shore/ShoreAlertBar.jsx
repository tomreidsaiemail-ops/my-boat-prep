import { CheckCircle2, Loader2, Siren, WifiOff, X } from "lucide-react";

const NAMES = { mayDay: "MAYDAY", panPan: "PAN-PAN" };
const RECENT_MS = 60 * 60 * 1000;
export const alertWhen = (iso) => (iso ? new Date(iso).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
export const alertKm = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export const alertWhere = (a) => {
  if (!a.pos) return a.last ? `No GPS fix when pressed, so the last reported position (${alertWhen(a.last.at)}) is shown.` : "No GPS fix when pressed and no earlier position.";
  if (a.near) return "Shown at the boat's last reported position (within 100 m).";
  return a.last ? `Alert position shown, ${alertKm(a.dist_m)} from the last reported position (${alertWhen(a.last.at)}).` : "Alert position shown. There was no earlier reported position.";
};

const StandDown = ({ onTick }) => (
  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-extrabold text-[var(--navy)]" data-testid="shore-alert-stand-down">
    <input type="checkbox" checked={false} onChange={onTick} className="h-6 w-6 shrink-0 accent-emerald-700" data-testid="shore-alert-stand-down-checkbox" />
    Stand down Shore Contact. No Mayday or Pan-Pan.
  </label>
);

const Box = ({ tone, icon, title, children, testId, state }) => (
  <section role="status" className={`flex flex-col gap-2 rounded-lg p-3 ${tone}`} data-testid={testId} data-state={state}>
    <p className="flex items-center gap-2 text-sm font-extrabold">{icon}{title}</p>
    {children}
  </section>
);

// Shows on every phone aboard: Shore Contact Alerted, with the stand-down tick, then Clearing… and Cleared.
export const ShoreAlertBar = ({ sa }) => {
  const { alert: a, phase } = sa;
  if (phase === "sending") return <Box tone="bg-[var(--red)] text-white" icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Alerting your shore contact…" testId="shore-alert-bar" state="sending" />;
  if (phase === "queued") return (
    <Box tone="bg-amber-500 text-white" icon={<WifiOff className="h-5 w-5" />} title="No signal: shore contact alert held" testId="shore-alert-bar" state="queued">
      <p className="text-sm">It sends with your GPS position as soon as there&apos;s a signal. Make the VHF call now.</p>
      <StandDown onTick={sa.standDown} />
    </Box>
  );
  if (phase === "cancelled") return (
    <Box tone="bg-emerald-700 text-white" icon={<CheckCircle2 className="h-5 w-5" />} title="Cleared: the held alert was cancelled before it was sent" testId="shore-alert-bar" state="cancelled">
      <button type="button" className="self-end text-xs font-bold underline" onClick={() => sa.hide("cancelled")} data-testid="shore-alert-dismiss-btn">Dismiss</button>
    </Box>
  );
  if (!a) return null;
  const name = NAMES[a.kind];
  if (phase === "clearing") return <Box tone="bg-[var(--navy)] text-white" icon={<Loader2 className="h-5 w-5 animate-spin" />} title={`Clearing shore contact ${name}…${sa.online ? "" : " (sends when there's signal)"}`} testId="shore-alert-bar" state="clearing" />;
  if (a.state === "active") return (
    <Box tone="bg-[var(--red)] text-white" icon={<Siren className="h-5 w-5" />} title={`Shore Contact Alerted · ${name}`} testId="shore-alert-bar" state="active">
      <p className="text-sm" data-testid="shore-alert-detail">Pressed {alertWhen(a.at)} by {a.by_name}. {alertWhere(a)}</p>
      <StandDown onTick={sa.standDown} />
    </Box>
  );
  const recent = Date.now() - new Date(a.cleared_at).getTime() < RECENT_MS;
  if (a.state !== "cleared" || sa.hidden === a.alert_id || (phase !== "cleared" && !recent)) return null;
  return (
    <Box tone="bg-emerald-700 text-white" icon={<CheckCircle2 className="h-5 w-5" />} title={`Cleared shore contact ${name}`} testId="shore-alert-bar" state="cleared">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm" data-testid="shore-alert-cleared-detail">Stood down {alertWhen(a.cleared_at)} by {a.cleared_by_name}. The shore contact map has cleared and they were told there&apos;s no Mayday or Pan-Pan.</p>
        <button type="button" className="icon-btn h-8 w-8 shrink-0 text-white" onClick={() => sa.hide(a.alert_id)} aria-label="Dismiss" data-testid="shore-alert-dismiss-btn"><X className="h-4 w-4" /></button>
      </div>
    </Box>
  );
};
