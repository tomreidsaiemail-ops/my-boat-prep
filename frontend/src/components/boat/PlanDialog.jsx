import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Crown, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { TopUpHistory } from "@/components/boat/TopUpHistory";

const PERKS = ["No ads", "Export All lists in one go", "Email PDF and Email Ship's Log (with Shore Contact)",
  "Create your own lists", "Clone lists", "Rename lists", "More than one boat", "Crew sharing", "Boat inventory and area tags", "Hide help panels", "Unlimited My To Do List items"];
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const TIER = { free: "Free", beta_tester: "Beta tester", pro: "Pro" };

const Perks = () => (
  <ul className="flex flex-col gap-1.5 text-sm" data-testid="plan-perks">
    {PERKS.map((p) => <li key={p} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green)]" strokeWidth={3} />{p}</li>)}
  </ul>
);

const ProStatus = ({ user, onRenewal, busy }) => (
  <div className="flex flex-col gap-3" data-testid="plan-status">
    <p className="text-sm">
      You&apos;re on <b data-testid="plan-tier">{user.is_admin && user.role === "free" ? "Admin" : user.launch_free && user.role === "free" ? "Pro, free during the FIRST200 launch" : TIER[user.role]}</b>: every feature, no ads.
      {user.has_subscription && (user.cancel_at_period_end
        ? <> Pro ends on <b>{fmt(user.pro_until)}</b>.</>
        : <> Renews automatically on <b data-testid="plan-renew-date">{fmt(user.pro_until)}</b>.</>)}
    </p>
    {user.has_subscription && !user.cancel_at_period_end && (
      <p className={`rounded-md px-3 py-2 text-xs ${user.first5000 ? "bg-emerald-50 text-emerald-900" : "bg-slate-100 text-slate-700"}`} data-testid="plan-price-notice">
        {user.first5000
          ? (user.renew_price && user.renew_price < 49.99
            ? `FIRST5000 member: your first renewal is half price (NZD ${user.renew_price.toFixed(2)}), then NZD 49.99 a year.`
            : "FIRST5000 member: your launch discount has been used. Renewals are NZD 49.99 a year.")
          : `Your renewal is NZD ${(user.renew_price || 49.99).toFixed(2)} a year.`}</p>
    )}
    {user.has_subscription && (
      <button type="button" className="btn-ghost" disabled={busy} onClick={() => onRenewal(user.cancel_at_period_end)} data-testid="plan-renewal-btn">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {user.cancel_at_period_end ? "Turn renewal back on" : "Cancel renewal"}
      </button>
    )}
  </div>
);

export const PlanDialog = ({ open, reason, onClose }) => {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState(null);
  useEffect(() => { if (open && user && !user.premium) api.get("/payments/offer").then(({ data }) => setOffer(data)).catch(() => {}); }, [open, user]);
  if (!user) return null;
  const full = offer?.price ? offer.price.toFixed(2) : "49.99";
  const first = offer?.first5000_price ? offer.first5000_price.toFixed(2) : "24.99";

  const upgrade = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/payments/checkout", { origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't start checkout. Check your signal and try again.");
      setBusy(false);
    }
  };
  const renewal = async (renew) => {
    setBusy(true);
    try {
      const { data } = await api.post("/payments/renewal", { renew });
      setUser(data);
      toast.success(renew ? "Pro will renew automatically" : "Renewal cancelled. Pro stays on until the end of your year");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't update your plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="plan-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl"><Crown className="h-5 w-5 text-amber-500" /> My Boat Prep Pro</DialogTitle>
          <DialogDescription data-testid="plan-reason">
            {reason ? <><b>{reason}</b> is a Pro feature.</> : "Everything you need for the boat, without the ads."}
          </DialogDescription>
        </DialogHeader>
        <Perks />
        {user.premium ? <><ProStatus user={user} onRenewal={renewal} busy={busy} /><TopUpHistory /></> : (
          <div className="flex flex-col gap-2">
            {offer?.first5000 && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950" data-testid="plan-first5000-offer">
                <b>FIRST5000 launch offer: 50% off.</b> NZD {first} for your first year and NZD {first} again at your first renewal, then NZD {full} a year.</p>
            )}
            <button type="button" className="btn-solid mt-1 w-full" onClick={upgrade} disabled={busy || !navigator.onLine} data-testid="plan-upgrade-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {!navigator.onLine ? "Go online to upgrade" : offer?.first5000 ? `Upgrade to Pro: NZD ${first} (50% off)` : `Upgrade to Pro: NZD ${full} / year`}
            </button>
            <p className="text-center text-xs text-[var(--muted)]" data-testid="plan-promo-hint">Have a promo code? Enter it on the Stripe payment page{offer?.first5000 ? ", it comes off the launch price too" : ""}.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
