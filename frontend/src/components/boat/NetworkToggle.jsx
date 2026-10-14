import { useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const NetworkToggle = ({ online, pending, onGoOffline, onGoOnline }) => {
  const [confirm, setConfirm] = useState(false);

  const confirmOnline = () => {
    setConfirm(false);
    if (!onGoOnline()) toast.error("No signal yet. Your changes stay in the outbox until you're back in range.");
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button type="button" data-testid="network-status" onClick={() => (online ? onGoOffline() : setConfirm(true))}
        className={`inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[11px] font-extrabold uppercase tracking-wider text-white active:scale-95 [transition:transform_.1s,background-color_.15s] ${online ? "bg-[var(--green)]" : "bg-[var(--red)]"}`}>
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        Status: {online ? "Online" : "Offline"}
      </button>
      <div className="text-[10px] font-bold leading-tight text-[var(--muted)]" data-testid="network-status-label">
        Tap to toggle{" "}
        <span className={online ? "text-[var(--red)]" : "text-[var(--green)]"}>{online ? "OFFLINE" : "ONLINE"}</span>
        {!online && pending > 0 && <span className="block font-semibold opacity-80">(and apply pending changes)</span>}
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="sync-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold">Go back online?</AlertDialogTitle>
            <AlertDialogDescription>Sync Cloud Database with Offline changes?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="sync-confirm-cancel-btn">Stay Offline</AlertDialogCancel>
            <AlertDialogAction className="btn-solid px-5" onClick={confirmOnline} data-testid="sync-confirm-ok-btn">Sync Now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
