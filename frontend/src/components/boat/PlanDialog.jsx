import { useState } from "react";
import { toast } from "sonner";
import { Check, Crown, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const PERKS = ["No ads", "Export All lists in one go", "Email PDF and Email Ship's Log (with Shore Contact)",
  "Create your own lists", "Clone lists", "Rename lists", "More than one boat", "Crew sharing", "Hide help panels", "Unlimited My To Do List items"];
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
      You&apos;re on <b data-testid="plan-tier">{user.is_admin && user.role === "free" ? "Admin" : TIER[user.role]}</b>: every feature, no ads.
      {user.has_subscription && (user.cancel_at_period_end
        ? <> Pro ends on <b>{fmt(user.pro_until)}</b>.</>
        : <> Renews on <b>{fmt(user.pro_until)}</b> for NZD 4.99.</>)}
    </p>
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
  if (!user) return null;

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
        {user.premium ? <ProStatus user={user} onRenewal={renewal} busy={busy} /> : (
          <button type="button" className="btn-solid mt-1 w-full" onClick={upgrade} disabled={busy || !navigator.onLine} data-testid="plan-upgrade-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            {navigator.onLine ? "Upgrade to Pro: NZD 4.99 / year" : "Go online to upgrade"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};
