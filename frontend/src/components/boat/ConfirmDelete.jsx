import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// `warning` shows in amber under the note, `strong` in bold just above the buttons, `children` after the buttons.
export const ConfirmDelete = ({ item, onConfirm, onClose, note = "It will be removed for every skipper.", title, confirmLabel = "Delete", cancelLabel = "Keep", testId = "media-delete", danger = true, warning, strong, children }) => (
  <AlertDialog open={!!item} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent className="max-h-[92vh] max-w-sm overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid={`${testId}-dialog`}>
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display text-xl font-extrabold">{title || <>Delete &quot;{item?.name}&quot;?</>}</AlertDialogTitle>
        <AlertDialogDescription data-testid={`${testId}-note`}>{note}</AlertDialogDescription>
      </AlertDialogHeader>
      {warning && <p role="alert" className="rounded-md border-[1.5px] border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950" data-testid={`${testId}-warning`}>{warning}</p>}
      {strong && <p className="text-sm font-extrabold text-[var(--navy)]" data-testid={`${testId}-strong`}>{strong}</p>}
      <AlertDialogFooter className="flex-row justify-end gap-2">
        <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid={`${testId}-cancel-btn`}>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction className={`btn-solid px-5 ${danger ? "!bg-[var(--red)]" : ""}`} onClick={onConfirm} data-testid={`${testId}-confirm-btn`}>{confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
      {children}
    </AlertDialogContent>
  </AlertDialog>
);
