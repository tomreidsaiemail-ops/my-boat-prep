import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Pick any other list for an imported item, e.g. My To Do List.
export const MoveItemDialog = ({ item, lists, onMove, onClose }) => {
  const [to, setTo] = useState(lists.find((l) => l.id === "myTodo")?.id || lists[0]?.id || "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="move-item-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><ArrowRightLeft className="h-5 w-5" /> Move item</DialogTitle>
          <DialogDescription className="text-left text-sm">Move "{item.label}" and its details to another list.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1">
          <span className="field-label">Move to</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="field-input h-11 !text-sm" data-testid="move-item-target-select">
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <DialogFooter className="flex-row justify-end gap-2">
          <button type="button" className="btn-ghost px-4" onClick={onClose} data-testid="move-item-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid px-5" disabled={!to} onClick={() => onMove(to)} data-testid="move-item-confirm-btn">Move</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
