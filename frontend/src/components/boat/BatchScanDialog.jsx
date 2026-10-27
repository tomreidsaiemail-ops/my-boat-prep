import { useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useBatchScan, { BATCH_MAX } from "@/hooks/useBatchScan";
import { BatchAreaForm } from "@/components/boat/BatchAreaForm";
import { BatchEntry } from "@/components/boat/BatchEntry";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { checkRows } from "@/components/boat/ScanReviewDialog";

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const Progress = ({ entries, position }) => {
  const left = entries.filter((e) => e.status === "queued" || e.status === "scanning").length;
  const ticked = entries.filter((e) => e.ticked).length;
  return (
    <p className="flex items-center gap-2 rounded-md bg-[var(--panel)] px-3 py-2 text-sm font-bold text-[var(--navy)]" data-testid="batch-progress">
      {position ? <><Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Scanning image {position} of {entries.length}{left > 1 ? ` · ${left - 1} waiting` : ""}</>
        : `All scans finished · ${ticked} of ${entries.length} reviewed`}
    </p>
  );
};

// Batch Magic Scan screen: queue several boat areas, review each one, then add them all at once.
export const BatchScanDialog = ({ open, boatId, areas, onClose, onConfirm }) => {
  const batch = useBatchScan(boatId);
  const { entries } = batch;
  const [form, setForm] = useState(true);
  const [doomed, setDoomed] = useState(null);
  const [discard, setDiscard] = useState(false);
  const existingFor = (name) => areas.find((a) => same(a.name, name));
  const full = entries.length >= BATCH_MAX;
  const ready = entries.length > 0 && entries.every((e) => e.ticked);

  const close = () => { batch.clear(); setDiscard(false); onClose(); };
  const askClose = () => (entries.length ? setDiscard(true) : close());
  const add = (name, blob, more) => { batch.add(name, blob); if (!more || entries.length + 1 >= BATCH_MAX) setForm(false); };
  const finish = () => {
    const out = entries.map((e) => ({ name: e.name, items: checkRows(e.rows) }));
    const bad = out.findIndex((o) => typeof o.items === "string");
    if (bad >= 0) { batch.patch(entries[bad].key, { ticked: false }); return; }
    batch.clear();
    onConfirm(out);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && askClose()}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-lg flex-col gap-3 overflow-hidden rounded-lg border-2 border-[var(--navy)] p-4" data-testid="batch-scan-dialog"
        onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><Sparkles className="h-5 w-5" /> Batch Magic Scan</DialogTitle>
          <DialogDescription>Add each boat area with a photo. Scans run in the background while you carry on. Review each one and tick it, then confirm.</DialogDescription>
        </DialogHeader>
        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1" data-testid="batch-list">
          {entries.length === 0 && <li className="rounded-lg border-[1.5px] border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]" data-testid="batch-empty">No boat areas in this batch yet.</li>}
          {entries.map((e, n) => (
            <BatchEntry key={e.key} entry={e} n={n} existing={existingFor(e.name)} onPatch={(p) => batch.patch(e.key, p)}
              onDelete={() => setDoomed(e)} onRetry={() => batch.retry(e.key)} />
          ))}
        </ul>
        <button type="button" className="btn-ghost h-11 justify-center" disabled={full} onClick={() => setForm(true)} data-testid="batch-add-area-btn">
          <Plus className="h-4 w-4" /> {full ? `Batch is full (${BATCH_MAX} boat areas)` : "Add a boat area"}
        </button>
        {entries.length > 0 && <Progress entries={entries} position={batch.position} />}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1" onClick={askClose} data-testid="batch-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-1 disabled:opacity-40" disabled={!ready} onClick={finish} data-testid="batch-confirm-btn">
            {entries.length === 1 ? "Done" : "Confirm Batch"}
          </button>
        </div>
        <BatchAreaForm open={open && form} existing={areas} batchNames={entries.map((e) => e.name)} full={entries.length + 1 >= BATCH_MAX}
          onAdd={add} onClose={() => setForm(false)} />
        <ConfirmDelete item={doomed} testId="batch-area-delete" note="Its photo and scanned contents are removed from this batch." cancelLabel="Keep"
          onConfirm={() => { batch.remove(doomed.key); setDoomed(null); }} onClose={() => setDoomed(null)} />
        <ConfirmDelete item={discard ? {} : null} testId="batch-discard" title="Discard this batch?" confirmLabel="Discard" cancelLabel="Keep going"
          note={`The ${entries.length} boat ${entries.length === 1 ? "area" : "areas"} and their scans will be thrown away. Nothing is added to your inventory.`}
          onConfirm={close} onClose={() => setDiscard(false)} />
      </DialogContent>
    </Dialog>
  );
};
