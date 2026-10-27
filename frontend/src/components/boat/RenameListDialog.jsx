import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ListDescriptionField } from "@/components/boat/ListDraftTools";

export const RenameListDialog = ({ list, onConfirm, onClose }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (list) { setName(list.name); setDescription(list.description || ""); setError(""); } }, [list]);
  const submit = (e) => {
    e.preventDefault();
    const res = onConfirm(name.trim(), description.trim());
    if (typeof res === "string") setError(res);
  };
  return (
    <Dialog open={!!list} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="rename-list-dialog" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Rename List</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-bold">List name
            <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="field-input font-normal" data-testid="rename-list-input" />
          </label>
          <ListDescriptionField value={description} onChange={setDescription} testId="rename-list" />
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
