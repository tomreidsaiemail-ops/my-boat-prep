import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, apiError, MAGIC_BUY_EVENT, MAGIC_LIMIT_EVENT } from "@/lib/api";

export const buyTopUp = async (pack = "small") => {
  const { data } = await api.post("/payments/topup-checkout", { origin_url: window.location.origin, pack });
  window.location.href = data.checkout_url;
};

const packsOf = (info) => info?.packs || (info?.pack_size ? [{ id: "small", size: info.pack_size, price: info.pack_price, price_text: info.price_text }] : []);

// Opens when a Magic request finds no Magic left (see lib/api.js), or from "Buy more Magic" in the account menu.
export const MagicLimitDialog = () => {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const limit = (e) => setState({ mode: "limit", info: e.detail });
    const buy = () => {
      setState({ mode: "buy", info: null });
      api.get("/magic/quota").then(({ data }) => setState((s) => s && { ...s, info: data }))
        .catch((e) => { toast.error(apiError(e, "Couldn't load the top-up packs")); setState(null); });
    };
    window.addEventListener(MAGIC_LIMIT_EVENT, limit);
    window.addEventListener(MAGIC_BUY_EVENT, buy);
    return () => { window.removeEventListener(MAGIC_LIMIT_EVENT, limit); window.removeEventListener(MAGIC_BUY_EVENT, buy); };
  }, []);
  const info = state?.info;
  const packs = packsOf(info);
  const buy = async (id) => {
    setBusy(id);
    try { await buyTopUp(id); } catch (e) { toast.error(apiError(e, "Couldn't start checkout")); setBusy(""); }
  };
  const limit = state?.mode === "limit";
  return (
    <AlertDialog open={!!state} onOpenChange={(o) => !o && !busy && setState(null)}>
      <AlertDialogContent className="max-w-md" data-testid="magic-limit-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[var(--amber)]" /> {limit ? "You've used all your Magic" : "Buy more Magic"}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-[var(--navy)]" data-testid="magic-limit-text">
            {limit ? info?.detail : info ? `You have ${info.left} of ${info.of} Magic generations left.` : "Loading your balance..."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {info && <p className="text-sm text-[var(--muted)]">Every account starts with {info.free_total} free. Each top-up is added on top of what you have left and never expires.</p>}
        <div className="flex flex-col gap-2">
          {packs.map((p) => (
            <button key={p.id} type="button" className="btn-solid h-12 justify-center gap-2" disabled={!!busy} onClick={() => buy(p.id)} data-testid={`magic-buy-${p.id}-btn`}>
              {busy === p.id && <Loader2 className="h-4 w-4 animate-spin" />}Buy +{p.size} for {p.price_text}
            </button>
          ))}
          {!info && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!busy} data-testid="magic-limit-cancel-btn">Not now</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
