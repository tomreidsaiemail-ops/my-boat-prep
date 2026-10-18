import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const TemplateUpdateNote = ({ listName, onGetLatest, onKeepMine }) => {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-[var(--blue)] bg-sky-50 p-3.5 text-sky-950" data-testid="template-update-note">
      <p className="flex items-start gap-2 text-sm leading-relaxed">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--blue)] px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white" data-testid="template-updated-badge">
          <Sparkles className="h-3 w-3" /> Updated
        </span>
        <span>New master items are available for <b>{listName}</b>.</span>
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-solid h-11 flex-1" onClick={() => setConfirm(true)} data-testid="template-get-latest-btn">Get latest items</button>
        <button type="button" className="btn-ghost h-11 px-4" onClick={onKeepMine} data-testid="template-keep-mine-btn">Keep mine</button>
      </div>
      <AlertDialog open={confirm} onOpenChange={(o) => !o && setConfirm(false)}>
        <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="template-get-latest-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold">Get the latest {listName} items?</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-[var(--navy)]">Your {listName} list is replaced with the latest master items, all unticked. Your edits and added items on this list are removed. Other lists are not changed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="template-get-latest-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction className="btn-solid px-5" onClick={() => { setConfirm(false); onGetLatest(); }} data-testid="template-get-latest-confirm-btn">Get latest</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
