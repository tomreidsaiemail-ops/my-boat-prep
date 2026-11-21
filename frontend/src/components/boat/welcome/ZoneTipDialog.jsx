import { ScanLine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Shown once after the Boat Inventory Set Up Wizard opens the new zone map.
export const ZoneTipDialog = ({ open, onClose }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="zone-tip-dialog">
      <DialogHeader>
        <DialogTitle className="font-display text-xl font-extrabold">Try your zone map</DialogTitle>
        <DialogDescription className="text-left text-sm text-[var(--ink,#0f172a)]">
          Tap a zone on your schematic, like the Galley or Cockpit, and add some cupboards. Then try a test magic scan: take a photo of a cupboard and the Magic Mariner lists what&apos;s in it for you.
        </DialogDescription>
      </DialogHeader>
      <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={onClose} data-testid="zone-tip-ok-btn"><ScanLine className="h-4 w-4" />Got it, show me my zone map</button>
    </DialogContent>
  </Dialog>
);
