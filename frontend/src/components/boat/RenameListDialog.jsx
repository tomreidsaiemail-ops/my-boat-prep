import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ListDescriptionField } from "@/components/boat/ListDraftTools";
import { MoveToAreaSection } from "@/components/boat/MoveToAreaSection";

const NO_MOVE = { area: "", ids: [] };

// Edit List Panel: rename, describe, and move list contents to a boat area (when the boat has areas).
export const RenameListDialog = ({ list, areas = [], items = [], labelFor, areaOf, onConfirm, onClose }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [move, setMove] = useState(NO_MOVE);
  const [error, setError] = useState("");
  useEffect(() => { if (list) { setName(list.name); setDescription(list.description || ""); setMove(NO_MOVE); setError(""); } }, [list]);
  const submit = (e) => {
    e.preventDefault();
    if (move.area && !move.ids.length) { setError("Nothing is ticked to move. Tick the items to move, or clear the boat area."); return; }
    const res = onConfirm(name.trim(), description.trim(), move.area ? move : null);
    if (typeof res === "string") setError(res);
  };
  return (
    <Dialog open={!!list} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="rename-list-dialog" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Edit List Panel</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-bold">List name
            <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="field-input font-normal" data-testid="rename-list-input" />
          </label>
          <ListDescriptionField value={description} onChange={setDescription} testId="rename-list" />
          {areas.length > 0 && items.length > 0 && <MoveToAreaSection areas={areas} items={items} labelFor={labelFor} areaOf={areaOf} move={move} onChange={(m) => { setMove(m); setError(""); }} />}
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="rename-list-error">{error}</div>}
          <DialogFooter className="flex-row justify-end gap-2">
            <button type="button" className="btn-ghost px-5" onClick={onClose} data-testid="rename-list-cancel-btn">Cancel</button>
            <button type="submit" className="btn-solid px-6" data-testid="rename-list-confirm-btn">Save</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
