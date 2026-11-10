import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { holdPrompt } from "@/lib/promptQueue";
import { forgetShownAgreements } from "@/components/boat/agreement/CrewAgreement";

const LATER_KEY = "mbp_invites_later";
const later = () => { try { return JSON.parse(sessionStorage.getItem(LATER_KEY)) || []; } catch { return []; } };

export const PendingInvitePrompt = ({ boats }) => {
  const [invites, setInvites] = useState(null);
  const [busy, setBusy] = useState("");
  const online = navigator.onLine;

  useEffect(() => {
    if (!online) { setInvites([]); return; }
    api.get("/crew/pending", { timeout: 10000 }).then(({ data }) => setInvites(data.invites.filter((i) => !later().includes(i.invite_id)))).catch(() => setInvites([]));
  }, [online]);

  const inv = invites?.[0];
  useEffect(() => { holdPrompt("invite", invites === null || !!inv); return () => holdPrompt("invite", false); }, [invites, inv]);
  if (!inv) return null;
  const next = () => setInvites((l) => l.slice(1));
  const act = async (kind) => {
    if (kind === "later") { sessionStorage.setItem(LATER_KEY, JSON.stringify([...later(), inv.invite_id])); next(); return; }
    setBusy(kind);
    try {
      const { data } = await api.post(`/crew/invites/${inv.invite_id}/${kind}`);
      if (kind === "accept") {
        forgetShownAgreements();
        await boats.refresh();
        boats.select(data.key);
        window.dispatchEvent(new Event("mbp:voyage-refresh"));
        toast.success(inv.aboard ? `You're on ${inv.trip_name || "the trip"} too` : `Welcome aboard ${inv.vessel}! It's now in your boat picker`);
      } else toast.message(`Invite to ${inv.vessel} declined`);
      next();
    } catch (e) { toast.error(apiError(e, "Couldn't do that, please try again")); next(); }
    finally { setBusy(""); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && act("later")}>
      <DialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="pending-invite-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{inv.aboard ? `Join ${inv.trip_name || "another trip"} on ${inv.vessel}?` : `Join the crew of ${inv.vessel}?`}</DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="pending-invite-text">
            {inv.aboard ? `${inv.skipper} has asked you to join another trip on ${inv.vessel}: ${inv.trip_name || "Route Planning"}.`
              : `${inv.skipper} has invited you aboard ${inv.vessel}${inv.trip_name ? ` for ${inv.trip_name}` : ""}. You'll see the boat's checklists on your phone and can tick items as you go.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!!busy} onClick={() => act("accept")} data-testid="pending-invite-join-btn">
            {busy === "accept" && <Loader2 className="h-4 w-4 animate-spin" />} {inv.aboard ? `Join ${inv.trip_name || "this trip"}` : `Join ${inv.vessel}`}
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost h-11 flex-1 justify-center" disabled={!!busy} onClick={() => act("later")} data-testid="pending-invite-later-btn">Not now</button>
            <button type="button" className="btn-ghost h-11 flex-1 justify-center hover:!text-[var(--red)]" disabled={!!busy} onClick={() => act("decline")} data-testid="pending-invite-decline-btn">
              {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin" />} Decline
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
