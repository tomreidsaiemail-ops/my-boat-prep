import { useState } from "react";
import { Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { serviceWording } from "@/lib/maint";

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const ItemPicks = ({ items, picked, setPicked }) => {
  const toggle = (ids, on) => setPicked((p) => (on ? [...new Set([...p, ...ids])] : p.filter((x) => !ids.includes(x))));
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border-[1.5px] border-[var(--line)] p-2" data-testid="maint-service-items">
      {items.map((it, n) => {
        const head = !it.indent;
        const kids = [];
        for (let k = n + 1; head && k < items.length && items[k].indent; k += 1) kids.push(items[k]);
        const ids = head ? kids.map((x) => x.id) : [it.id];
        const on = ids.length > 0 && ids.every((x) => picked.includes(x));
        if (head && !kids.length) return null;
        return (
          <label key={it.id} className={`flex min-h-[36px] cursor-pointer items-center gap-2 text-sm ${head ? "font-bold" : "pl-6"}`}>
            <input type="checkbox" checked={on} onChange={(e) => toggle(ids, e.target.checked)} className="h-4 w-4 accent-[var(--navy)]" data-testid={`maint-service-pick-${it.id}`} />
            {it.label}
          </label>
        );
      })}
    </div>
  );
};

// Log Rigging Check / Log Service on a Boat Maintenance list: sets the items' dates and goes into the Rigging Service History and Ship's Log.
export const MaintServiceDialog = ({ list, items, preselect = [], onSave, onClose }) => {
  const w = serviceWording(list.maint);
  const [picked, setPicked] = useState(preselect);
  const [by, setBy] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const save = () => {
    if (!picked.length) return setError("Pick at least one item");
    if (!by.trim()) return setError(`Enter the ${w.who.toLowerCase()}`);
    if (!date) return setError("Pick the date");
    if (due && due <= date) return setError("The next due date has to be after the service date");
    onSave({ ids: picked, by: by.trim(), date, notes: notes.trim(), due });
    return null;
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto" data-testid="maint-service-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl"><Wrench className="h-5 w-5" /> {w.button}</DialogTitle>
          <DialogDescription>{list.name}: pick the items you checked or serviced. It sets their Last service (and Service due) dates and goes in the Rigging Service History and the Ship&apos;s Log.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <ItemPicks items={items} picked={picked} setPicked={setPicked} />
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 flex flex-col gap-1"><span className="field-label">{w.who}</span>
              <input value={by} onChange={(e) => setBy(e.target.value.slice(0, 80))} placeholder={w.placeholder} className="field-input" data-testid="maint-service-by" /></label>
            <label className="flex flex-col gap-1"><span className="field-label">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input" data-testid="maint-service-date" /></label>
            <label className="flex flex-col gap-1"><span className="field-label">Next due (optional)</span>
              <input type="date" value={due} min={date} onChange={(e) => setDue(e.target.value)} className="field-input" data-testid="maint-service-due" /></label>
            <label className="col-span-2 flex flex-col gap-1"><span className="field-label">{w.notes}</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 1000))} rows={3} placeholder={w.notesHint} className="field-input min-h-[80px] py-2" data-testid="maint-service-notes" /></label>
          </div>
          {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="maint-service-error">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" className="btn-ghost px-4" onClick={onClose} data-testid="maint-service-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid px-4" onClick={save} data-testid="maint-service-save-btn">Save {picked.length ? `(${picked.length})` : ""}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
