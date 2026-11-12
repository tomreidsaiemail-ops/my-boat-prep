import { useState } from "react";
import { Archive, ChevronDown, Eye, Loader2, RotateCcw } from "lucide-react";
import { ArchivedTripDialog } from "@/components/boat/trips/ArchivedTripDialog";
import { statLine } from "@/lib/tripArchive";

const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "");

const Row = ({ a, onView, onRestore }) => {
  const [busy, setBusy] = useState(false);
  const route = [a.route_start, a.route_dest].filter(Boolean).join(" → ");
  return (
    <li className="flex flex-col gap-2 px-3 py-3" data-testid={`archived-trip-${a.archive_id}`}>
      <div className="min-w-0">
        <p className="truncate font-extrabold text-[var(--navy)]" data-testid={`archived-trip-name-${a.archive_id}`}>{a.name}</p>
        <p className="text-xs text-[var(--muted)]">Archived {day(a.archived_at)}{route ? ` · ${route}` : ""}</p>
        <p className="text-xs text-[var(--muted)]" data-testid={`archived-trip-stats-${a.archive_id}`}>{statLine(a.stats)}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost min-h-10 flex-1 gap-1.5 px-3 text-sm" onClick={() => onView(a)} data-testid={`archived-trip-view-${a.archive_id}`}><Eye className="h-4 w-4" /> View</button>
        <button type="button" className="btn-solid min-h-10 flex-1 gap-1.5 px-3 text-sm" disabled={busy} data-testid={`archived-trip-restore-${a.archive_id}`}
          onClick={async () => { setBusy(true); await onRestore(a); setBusy(false); }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Restore
        </button>
      </div>
    </li>
  );
};

// Tucked away at the very bottom of every Route Planning list.
export const ArchivedTrips = ({ trips, listName, online, onArchive, busy }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const list = trips.archives || [];
  return (
    <section className="mt-2 flex flex-col gap-2 border-t-[1.5px] border-dashed border-[var(--line)] pt-4" data-testid="archived-trips">
      <button type="button" className="btn-ghost min-h-10 gap-2 self-start px-3 text-sm" onClick={onArchive} disabled={busy || !online} data-testid="archive-trip-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Archive {listName} and reset
      </button>
      <button type="button" className="flex min-h-11 items-center justify-between gap-2 rounded-md bg-slate-100 px-3 text-left text-sm font-extrabold text-[var(--navy)]" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="archived-trips-toggle">
        <span className="flex items-center gap-2"><Archive className="h-4 w-4" /> Archived Trips <span className="font-bold text-[var(--muted)]" data-testid="archived-trips-count">({trips.archives === null ? "…" : list.length})</span></span>
        <ChevronDown className={`h-4 w-4 [transition:transform_.2s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (trips.archives === null ? <p className="px-1 text-sm text-[var(--muted)]" data-testid="archived-trips-offline">{online ? "Loading…" : "Archived Trips show when you have a signal."}</p>
        : list.length === 0 ? <p className="px-1 text-sm text-[var(--muted)]" data-testid="archived-trips-empty">No archived trips yet. When a trip&apos;s estimated finish passes you&apos;ll be asked to archive it.</p>
        : <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-md border-[1.5px] border-[var(--line)] bg-white" data-testid="archived-trips-list">
            {list.map((a) => <Row key={a.archive_id} a={a} onView={setView} onRestore={trips.restore} />)}
          </ul>)}
      {view && <ArchivedTripDialog summary={view} load={trips.load} onRestore={trips.restore} onDelete={trips.remove} onClose={() => setView(null)} />}
    </section>
  );
};
