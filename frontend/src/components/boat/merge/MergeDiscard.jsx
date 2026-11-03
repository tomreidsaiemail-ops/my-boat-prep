import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// The two all-or-nothing choices: throw away my changes (take the master as is) or throw away the master updates.
export const MergeDiscard = ({ listName, onTakeMaster, onKeepMine }) => {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col gap-2 border-t-[1.5px] border-[var(--line)] pt-3" data-testid="merge-discard">
      <button type="button" className="btn-ghost h-11 justify-center text-sm" onClick={onKeepMine} data-testid="merge-discard-master-btn">Throw away the master updates</button>
      <button type="button" className="btn-ghost h-11 justify-center text-sm !text-[var(--red)] !border-[var(--red)]" onClick={() => setConfirm(true)} data-testid="merge-discard-mine-btn">Throw away my changes</button>
      <AlertDialog open={confirm} onOpenChange={(o) => !o && setConfirm(false)}>
        <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="merge-discard-mine-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold">Throw away your changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-[var(--navy)]">Your {listName} is replaced with the latest master items, all unticked. Your edits and added items on this list are removed. Other lists are not changed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="merge-discard-mine-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction className="btn-solid !bg-[var(--red)] px-5" onClick={() => { setConfirm(false); onTakeMaster(); }} data-testid="merge-discard-mine-confirm-btn">Throw away</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
