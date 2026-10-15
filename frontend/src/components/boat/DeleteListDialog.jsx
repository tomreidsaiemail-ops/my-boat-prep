import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const DeleteListDialog = ({ list, onConfirm, onClose }) => (
  <AlertDialog open={!!list} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="delete-list-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display text-xl font-extrabold">Delete &quot;{list?.name}&quot;?</AlertDialogTitle>
        <AlertDialogDescription>
          {list?.isSystem
            ? "This supplied list will be removed. Reset All brings it back later with its original items."
            : "This list will be removed for good."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row justify-end gap-2">
        <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="delete-list-cancel-btn">Keep List</AlertDialogCancel>
        <AlertDialogAction className="btn-solid bg-[var(--red)] px-5" onClick={onConfirm} data-testid="delete-list-confirm-btn">Delete List</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
