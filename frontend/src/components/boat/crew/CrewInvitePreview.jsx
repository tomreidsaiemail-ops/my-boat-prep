import { useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { CrewAgreementDialog } from "@/components/boat/agreement/CrewAgreementDialog";

// Preview Crew Member Invite: the invite the crew member gets, then (on Join) exactly the agreement they go through.
// Nothing is sent, joined or saved, and the skipper's own ticks don't count.
export const CrewInvitePreview = ({ invite, boat, vessel, skipper, areas, online, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    api.get(`/boats/${boat.boat_id}/crew-preview`, { params: { roles: invite.roles }, paramsSerializer: { indexes: null }, timeout: 15000 })
      .then(({ data: d }) => setData(d)).catch((e) => setError(apiError(e, "Couldn't load the preview, please try again")));
  }, [boat.boat_id, invite.roles]);
  const who = invite.name || invite.email;
  if (joined && data) return <CrewAgreementDialog preview={who} data={data} boat={boat} vessel={vessel} areas={areas} online={online} onSaved={() => {}} onRead={() => {}} onClose={onClose} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent guard={false} className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="crew-invite-preview-dialog">
        <p className="-mx-6 -mt-6 flex items-center gap-2 rounded-t-md bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900" data-testid="crew-invite-preview-banner">
          <Eye className="h-4 w-4 shrink-0" /> Preview: {who} will receive an invite to join {vessel}. When they press Join they get the screen that follows.
        </p>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Join the crew of {vessel}?</DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="crew-invite-preview-text">
            {skipper} has invited you aboard {vessel}{invite.trip_name ? ` for ${invite.trip_name}` : ""}. You&apos;ll see the boat&apos;s checklists on your phone and can tick items as you go.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]">{error}</p>}
        <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!data} onClick={() => setJoined(true)} data-testid="crew-invite-preview-join-btn">
          {!data && !error && <Loader2 className="h-4 w-4 animate-spin" />} Join {vessel}
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="crew-invite-preview-later-btn">Not now</button>
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="crew-invite-preview-decline-btn">Decline</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
