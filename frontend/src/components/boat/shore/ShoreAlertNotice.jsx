import { useState } from "react";
import { CheckCircle2, Eye, Loader2, Siren } from "lucide-react";
import { alertWhen, alertWhere } from "@/components/boat/shore/ShoreAlertBar";

const NAMES = { mayDay: "MAYDAY", panPan: "PAN-PAN" };

// What the shore contact sees: a red Mayday / Pan-Pan alert, or the green stand-down once someone aboard clears it.
export const ShoreAlertNotice = ({ alert: a, me, onSeen }) => {
  const [busy, setBusy] = useState(false);
  if (!a) return null;
  if (a.state === "cleared") {
    if (Date.now() - new Date(a.cleared_at).getTime() > 24 * 3600 * 1000) return null;
    return (
      <p className="flex items-start gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white" data-testid="shore-alert-notice" data-state="cleared">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Stood down {alertWhen(a.cleared_at)} by {a.cleared_by_name}: no Mayday or Pan-Pan. No action needed.
      </p>
    );
  }
  return (
    <section role="alert" className="flex flex-col gap-1 rounded-lg bg-[var(--red)] px-3 py-3 text-white" data-testid="shore-alert-notice" data-state="active">
      <p className="flex items-center gap-2 text-lg font-extrabold"><Siren className="h-5 w-5 animate-pulse" /> {NAMES[a.kind]} pressed</p>
      <p className="text-sm font-semibold" data-testid="shore-alert-notice-detail">{alertWhen(a.at)} by {a.by_name}. {alertWhere(a)}</p>
      {a.pos && <p className="text-xs" data-testid="shore-alert-notice-pos">Position when pressed: {a.pos.lat.toFixed(5)}, {a.pos.lon.toFixed(5)}</p>}
      <p className="text-xs">Try calling the skipper. If you can&apos;t reach the boat and are worried, contact the Coastguard or emergency services.</p>
      {(a.seen || []).length > 0 && <p className="text-xs font-bold" data-testid="shore-alert-notice-seen">Seen by {a.seen.map((s) => s.name).join(", ")}</p>}
      {onSeen && !(a.seen || []).some((s) => s.by === me) && (
        <button type="button" className="btn-ghost mt-1 min-h-11 justify-center gap-2 bg-white text-[var(--red)]" disabled={busy} data-testid="shore-alert-seen-btn"
          onClick={async () => { setBusy(true); await onSeen(a); setBusy(false); }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} I&apos;ve seen it, tell the boat
        </button>
      )}
    </section>
  );
};
