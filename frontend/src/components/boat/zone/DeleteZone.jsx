import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Bottom of the zone window: removes the zone, its photos and schematic spots; its cupboards stay, with no zone.
export const DeleteZone = ({ zone, summary, onDelete, t }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (e) => { e.preventDefault(); setBusy(true); const ok = await onDelete(zone); setBusy(false); if (ok) setOpen(false); };
  return (
    <>
      <button type="button" className="btn-ghost h-11 justify-center gap-2 text-sm text-[var(--red)]" onClick={() => setOpen(true)} data-testid={`${t}-delete-zone-btn`}>
        <Trash2 className="h-4 w-4" /> Delete Zone...
      </button>
      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent className="rounded-lg border-2 border-[var(--navy)]" data-testid={`${t}-delete-zone-dialog`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg font-extrabold">Delete the {zone.label} zone?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2 text-left text-sm text-[var(--ink,#0f172a)]" data-testid={`${t}-delete-zone-summary`}>
                <p>This removes:</p>
                <ul className="list-disc pl-5">
                  <li>{plural(summary.photos, "zone photo")}</li>
                  <li>{plural(summary.spots, "spot")} on the schematic</li>
                </ul>
                <p>{summary.cupboards ? `${plural(summary.cupboards, "cupboard")}${summary.boxes ? ` (with ${plural(summary.boxes, "box or folder")})` : ""} and their ${plural(summary.items, "item")} stay on your list, with no zone.` : "No cupboards are in this zone."}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} data-testid={`${t}-delete-zone-cancel`}>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={go} disabled={busy} className="bg-[var(--red)] hover:bg-red-700" data-testid={`${t}-delete-zone-confirm`}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Delete zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
