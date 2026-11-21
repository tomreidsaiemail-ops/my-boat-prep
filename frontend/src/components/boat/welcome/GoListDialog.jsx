import { ArrowRight, Home } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Welcome "Make X my home": offer to leave Welcome and go there now.
export const GoListDialog = ({ list, onGo, onStay }) => (
  <Dialog open={!!list} onOpenChange={(o) => !o && onStay()}>
    <DialogContent guard={false} className="max-w-sm rounded-lg border-2 border-[var(--navy)] bg-white" data-testid="go-list-dialog">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-lg font-black text-[var(--navy)]"><Home className="h-5 w-5" /> {list?.name} is your home list</DialogTitle>
        <DialogDescription className="text-sm text-slate-700">Would you like to go to {list?.name} now? This leaves the Welcome screen; you can come back to it any time from the list picker.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <button type="button" className="btn-solid h-11 justify-center gap-2" onClick={onGo} data-testid="go-list-yes-btn">Yes, go to {list?.name} now <ArrowRight className="h-4 w-4" /></button>
        <button type="button" className="btn-ghost h-11 justify-center" onClick={onStay} data-testid="go-list-stay-btn">Stay on Welcome</button>
      </div>
    </DialogContent>
  </Dialog>
);
