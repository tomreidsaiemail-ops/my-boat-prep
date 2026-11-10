import { toast } from "sonner";
import { Copy, MessageSquareText } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const SkipperComment = ({ text, testId, label = "Skipper's comment" }) => (text || "").trim() ? (
  <div className="flex gap-2 rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--navy)]" data-testid={testId}>
    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
    <p className="min-w-0 whitespace-pre-line"><b>{label}:</b> {text.trim()}</p>
  </div>
) : null;

export const CupboardName = ({ name, testId }) => (
  <p className="text-sm text-[var(--navy)]" data-testid={testId}><span className="field-label mr-1">Cupboard:</span><b className="break-words">{name}</b></p>
);

const copy = (text) => {
  const fail = () => toast.error("Couldn't copy, select the text instead");
  if (!navigator.clipboard) { fail(); return; }
  navigator.clipboard.writeText(text).then(() => toast.success("Skipper's comment copied"), fail);
};

// Removing a photo that carries a Skipper's comment: show it and offer to copy it first.
export const RemoveMapConfirm = ({ map, onConfirm, onClose }) => (
  <AlertDialog open={!!map} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent className="max-h-[92vh] max-w-sm overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="zone-map-remove-comment-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display text-xl font-extrabold">This photo has a Skipper&apos;s comment</AlertDialogTitle>
        <AlertDialogDescription>Removing the photo also removes its comment. Copy it first if you&apos;re replacing this with a better picture.</AlertDialogDescription>
      </AlertDialogHeader>
      <p className="select-text whitespace-pre-line rounded-md border-[1.5px] border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950" data-testid="zone-map-remove-comment-text">{map?.comment}</p>
      <button type="button" className="btn-ghost h-10 justify-center gap-2 text-sm" onClick={() => copy(map.comment)} data-testid="zone-map-remove-comment-copy-btn"><Copy className="h-4 w-4" /> Copy comment</button>
      <AlertDialogFooter className="flex-row justify-end gap-2">
        <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="zone-map-remove-comment-cancel-btn">Keep</AlertDialogCancel>
        <AlertDialogAction className="btn-solid !bg-[var(--red)] px-5" onClick={onConfirm} data-testid="zone-map-remove-comment-confirm-btn">Remove photo</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
