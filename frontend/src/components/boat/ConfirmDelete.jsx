import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ConfirmDelete = ({ item, onConfirm, onClose, note = "It will be removed for every skipper.", title, confirmLabel = "Delete", cancelLabel = "Keep", testId = "media-delete", danger = true }) => (
  <AlertDialog open={!!item} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid={`${testId}-dialog`}>
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display text-xl font-extrabold">{title || <>Delete &quot;{item?.name}&quot;?</>}</AlertDialogTitle>
        <AlertDialogDescription data-testid={`${testId}-note`}>{note}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row justify-end gap-2">
        <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid={`${testId}-cancel-btn`}>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction className={`btn-solid px-5 ${danger ? "bg-[var(--red)]" : ""}`} onClick={onConfirm} data-testid={`${testId}-confirm-btn`}>{confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
