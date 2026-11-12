import { useEffect, useState } from "react";
import { Anchor, Archive, Check, Loader2, RotateCcw, Square, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { ShoreMap } from "@/components/boat/shore/ShoreMap";
import { when } from "@/lib/routeNotes";
import { statLine } from "@/lib/tripArchive";

const Section = ({ title, children, testId }) => (
  <section className="flex flex-col gap-1.5" data-testid={testId}>
    <h3 className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">{title}</h3>
    {children}
  </section>
);

const routeLines = (a) => {
  const d = a.details || {};
  const w = d.weather || {};
  return [["Start", d.route_start], ["Destination", d.route_dest], ["Why we're going", w.why], ["Departure", when(w.depart_at)], ["Event", w.event_name], ["Estimated finish", when(w.finish_at)]]
    .filter(([, v]) => String(v || "").trim());
};

const stops = (a) => a.path.filter((p) => p.kind === "stop");

const Body = ({ a }) => (
  <div className="flex flex-col gap-4">
    <Section title="Route" testId="archived-trip-route">
      {routeLines(a).length ? routeLines(a).map(([k, v]) => <p key={k} className="text-sm"><b>{k}:</b> {v}</p>) : <p className="text-sm text-[var(--muted)]">No route details were saved.</p>}
      {a.notes && <p className="whitespace-pre-line rounded-md bg-slate-50 p-2 text-sm">{a.notes}</p>}
    </Section>
    <Section title="Stats" testId="archived-trip-stats"><p className="text-sm">{statLine(a.stats)}</p></Section>
    <Section title="GPS path" testId="archived-trip-path">
      {a.path.length ? <ShoreMap points={a.path} endLabel="End" className="h-[40vh] min-h-[240px]" /> : <p className="text-sm text-[var(--muted)]">No positions were shared on this trip.</p>}
    </Section>
    {stops(a).length > 0 && (
      <Section title={`Stops (${stops(a).length})`} testId="archived-trip-stops">
        {stops(a).map((p, n) => <p key={n} className="flex items-center gap-1.5 text-sm" data-testid={`archived-trip-stop-${n}`}><Anchor className="h-4 w-4 shrink-0 text-[var(--navy)]" /> Stopped {when(p.at)}</p>)}
      </Section>
    )}
    <Section title={`Crew (${a.crew.length})`} testId="archived-trip-crew">
      {a.crew.length + a.invites.length === 0 && <p className="text-sm text-[var(--muted)]">No crew on this trip.</p>}
      {a.crew.map((c, n) => <p key={n} className="text-sm"><b>{c.name}</b>{c.roles?.length ? ` · ${c.roles.join(", ")}` : ""}{c.rsvp ? ` · replied ${c.rsvp}` : ""}</p>)}
      {a.invites.map((i, n) => <p key={`i${n}`} className="text-sm text-[var(--muted)]">{i.name || i.email} (invited)</p>)}
    </Section>
    <Section title={`Checklist (${a.items.length})`} testId="archived-trip-items">
      <ul className="divide-y divide-[var(--line)] rounded-md border-[1.5px] border-[var(--line)]">
        {a.items.map((i) => (
          <li key={i.id} className="flex items-start gap-2 px-2 py-1.5 text-sm">
            {i.checked ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Square className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />}
            <span className={i.checked ? "" : "text-[var(--muted)]"}>{i.label}</span>
          </li>
        ))}
      </ul>
    </Section>
  </div>
);

// Read-only look back at an archived trip, with Restore and Delete.
export const ArchivedTripDialog = ({ summary, load, onRestore, onDelete, onClose }) => {
  const [a, setA] = useState(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { load(summary.archive_id).then(setA).catch(() => setError("Couldn't open this archived trip. Check your signal and try again.")); }, [summary.archive_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="archived-trip-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left font-display text-xl font-extrabold"><Archive className="h-5 w-5 shrink-0" /> {summary.name}</DialogTitle>
          <DialogDescription className="text-left text-sm">Archived {new Date(summary.archived_at).toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}. Read only.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid="archived-trip-error">{error}</p>}
        {!a && !error && <Loader2 className="h-6 w-6 animate-spin" />}
        {a && <Body a={a} />}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost gap-1.5 px-4 text-[var(--red)]" onClick={() => setConfirm(true)} data-testid="archived-trip-delete-btn"><Trash2 className="h-4 w-4" /> Delete</button>
          <button type="button" className="btn-solid gap-1.5 px-5" disabled={busy} data-testid="archived-trip-dialog-restore-btn"
            onClick={async () => { setBusy(true); if (await onRestore(summary)) onClose(); else setBusy(false); }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Restore
          </button>
        </div>
        <ConfirmDelete item={confirm ? { name: summary.name } : null} testId="archived-trip-delete" note="This archived trip, its checklist and GPS path are deleted for good."
          onConfirm={async () => { await onDelete(summary); onClose(); }} onClose={() => setConfirm(false)} />
      </DialogContent>
    </Dialog>
  );
};
