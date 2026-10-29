import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, apiError, MAGIC_LIMIT_EVENT } from "@/lib/api";

export const buyTopUp = async () => {
  const { data } = await api.post("/payments/topup-checkout", { origin_url: window.location.origin });
  window.location.href = data.checkout_url;
};

// Opens whenever any Magic request comes back with the daily-limit response (see lib/api.js).
export const MagicLimitDialog = () => {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const open = (e) => setInfo(e.detail);
    window.addEventListener(MAGIC_LIMIT_EVENT, open);
    return () => window.removeEventListener(MAGIC_LIMIT_EVENT, open);
  }, []);
  const buy = async () => {
    setBusy(true);
    try { await buyTopUp(); } catch (e) { toast.error(apiError(e, "Couldn't start checkout")); setBusy(false); }
  };
  return (
    <AlertDialog open={!!info} onOpenChange={(o) => !o && !busy && setInfo(null)}>
      <AlertDialogContent className="max-w-md" data-testid="magic-limit-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[var(--amber)]" /> Daily Magic limit reached</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-[var(--navy)]" data-testid="magic-limit-text">{info?.detail}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-[var(--muted)]">Bought generations are used after your free daily ones and roll over until you use them. Your free {info?.daily_limit} come back at midnight.</p>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy} data-testid="magic-limit-cancel-btn">Not now</AlertDialogCancel>
          <button type="button" className="btn-solid justify-center px-5" disabled={busy} onClick={buy} data-testid="magic-limit-buy-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Buy +{info?.pack_size} for {info?.price_text}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
