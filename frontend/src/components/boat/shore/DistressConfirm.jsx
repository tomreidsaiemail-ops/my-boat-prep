import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TEXT = {
  mayDay: { title: "Confirm imminent danger MAYDAY event to Shore Contact.", tone: "bg-[var(--red)] hover:bg-red-800" },
  panPan: { title: "Confirm urgent PAN-PAN event to Shore Contact.", tone: "bg-orange-500 hover:bg-orange-600" },
};

// One tap before a Mayday / Pan-Pan reaches the shore contact. Confirm sends it in the background while the call is made;
// Ignore sends nothing (a test, or a skipper walkthrough).
export const DistressConfirm = ({ kind, onConfirm, onIgnore }) => {
  const t = TEXT[kind];
  if (!t) return null;
  const ignore = () => { onIgnore(); toast.message("Not sent to your shore contact, treated as a test"); };
  return (
    <Dialog open onOpenChange={(o) => !o && ignore()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-sm rounded-lg border-2 border-[var(--navy)] p-4" data-testid="distress-confirm-dialog">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold leading-snug text-[var(--navy)]" data-testid="distress-confirm-title">{t.title}</DialogTitle>
          <DialogDescription>Confirm alerts your shore contact in the background while you make the call. Ignore if this is a test or a skipper walkthrough.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onConfirm} className={`h-12 rounded-md text-base font-extrabold uppercase text-white shadow-sm active:scale-95 [transition:background-color_.15s,transform_.1s] ${t.tone}`} data-testid="distress-confirm-btn">Confirm</button>
          <button type="button" onClick={ignore} className="btn-ghost h-12 justify-center text-base font-extrabold" data-testid="distress-ignore-btn">Ignore</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
