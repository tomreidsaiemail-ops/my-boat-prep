import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BUDGET_KIND } from "@/lib/budget";

const bodyText = (list, sure) => {
  if (list?.kind === BUDGET_KIND) {
    return sure
      ? "Your budgeting history (every cost, date paid and web link) will be gone for good. Reset All can only bring back an empty budget from the template."
      : "This removes your Boat Budget with all its costs, dates paid and web links.";
  }
  return list?.isSystem ? "This supplied list will be removed. Reset All brings it back later with its original items." : "This list will be removed for good.";
};

// The Boat Budget asks twice ("Are you absolutely certain?") before its history is removed.
export const DeleteListDialog = ({ list, onConfirm, onClose }) => {
  const [sure, setSure] = useState(false);
  useEffect(() => { setSure(false); }, [list?.id]);
  const twice = list?.kind === BUDGET_KIND && !sure;
  return (
    <AlertDialog open={!!list} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="delete-list-dialog" data-stage={sure ? "certain" : "first"}>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl font-extrabold" data-testid="delete-list-title">
            {sure ? "Are you absolutely certain?" : <>Delete &quot;{list?.name}&quot;?</>}
          </AlertDialogTitle>
          <AlertDialogDescription data-testid="delete-list-description">{bodyText(list, sure)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2">
          <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="delete-list-cancel-btn">{list?.kind === BUDGET_KIND ? "Keep Budget" : "Keep List"}</AlertDialogCancel>
          <AlertDialogAction className="btn-solid !bg-[var(--red)] px-5" data-testid={sure ? "delete-list-certain-btn" : "delete-list-confirm-btn"}
            onClick={(e) => { if (twice) { e.preventDefault(); setSure(true); } else onConfirm(); }}>
            {sure ? "Yes, delete it" : "Delete List"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
