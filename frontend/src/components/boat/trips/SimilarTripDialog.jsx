import { useEffect, useState } from "react";
import { CopyPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const today = () => new Date().toLocaleDateString("en-CA");

// Create Similar Trip: asks for the new departure date (today or later) and trip name.
export const SimilarTripDialog = ({ archive, load, onCreate, onClose }) => {
  const [depart, setDepart] = useState(today());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { load(archive.archive_id).then((d) => setName((n) => n || d.details?.weather?.event_name || archive.name)).catch(() => setName((n) => n || archive.name)); }, [archive, load]);
  const ok = depart >= today() && name.trim();
  const create = async () => { setBusy(true); if (await onCreate(depart, name.trim())) onClose(); else setBusy(false); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="similar-trip-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[var(--navy)]">Create Similar Trip</DialogTitle>
          <DialogDescription>A copy of {archive.name} with the same route, plan, checklist (unticked) and crew. Every date moves to suit the new departure, and the Actual Finish is cleared. The archive stays as it is.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Departure date</span>
          <input type="date" value={depart} min={today()} onChange={(e) => setDepart(e.target.value)} className="field-input" data-testid="similar-trip-date-input" />
          {depart && depart < today() && <span className="text-xs font-bold text-[var(--red)]" data-testid="similar-trip-date-error">Pick today or a later date</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">New trip name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="field-input" placeholder="Event or Trip name" data-testid="similar-trip-name-input" />
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost min-h-11 flex-1" onClick={onClose} data-testid="similar-trip-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid min-h-11 flex-1 gap-1.5" disabled={!ok || busy} onClick={create} data-testid="similar-trip-create-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />} Create
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
