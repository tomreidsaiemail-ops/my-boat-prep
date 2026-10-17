import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ConfirmDelete = ({ item, onConfirm, onClose }) => (
  <AlertDialog open={!!item} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="media-delete-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display text-xl font-extrabold">Delete &quot;{item?.name}&quot;?</AlertDialogTitle>
        <AlertDialogDescription>It will be removed for every skipper.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row justify-end gap-2">
        <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="media-delete-cancel-btn">Keep</AlertDialogCancel>
        <AlertDialogAction className="btn-solid bg-[var(--red)] px-5" onClick={onConfirm} data-testid="media-delete-confirm-btn">Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
