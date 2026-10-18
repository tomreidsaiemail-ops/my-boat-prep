import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, UserMinus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { PhotoPicker } from "@/components/boat/PhotoPicker";

const Row = ({ title, sub, onRemove, label, testId }) => (
  <li className="flex items-center gap-2 px-3 py-2.5" data-testid={testId}>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{title}</p><p className="truncate text-xs text-[var(--muted)]">{sub}</p></div>
    <button type="button" className="icon-btn hover:text-[var(--red)]" onClick={onRemove} aria-label={label} title={label} data-testid={`${testId}-remove-btn`}>
      {label.startsWith("Cancel") ? <X className="h-[18px] w-[18px]" /> : <UserMinus className="h-[18px] w-[18px]" />}
    </button>
  </li>
);

export const CrewDialog = ({ open, boat, name, online, premium, onUpgrade, onPhoto, onClose }) => {
  const [info, setInfo] = useState({ crew: [], invites: [] });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api.get(`/boats/${boat.boat_id}/crew`).then(({ data }) => setInfo(data)).catch(() => {}), [boat.boat_id]);
  useEffect(() => { if (open) { setError(""); setEmail(""); if (online) load(); } }, [open, online, load]);

  const invite = async (e) => {
    e.preventDefault();
    if (!premium) { onUpgrade(); return; }
    if (!online) { setError("You're offline. Send the invite when you have signal."); return; }
    if (!email.trim()) { setError("Please enter your crew member's email"); return; }
    setBusy(true); setError("");
    try {
      await api.post(`/boats/${boat.boat_id}/invites`, { email: email.trim() }, { timeout: 30000 });
      toast.success(`Invite emailed to ${email.trim()}`);
      setEmail("");
      load();
    } catch (err) { setError(apiError(err, "Couldn't send the invite, please try again")); }
    finally { setBusy(false); }
  };
  const run = async (fn, msg) => {
    if (!online) { toast.error("Go online to change your crew"); return; }
    try { await fn(); toast.success(msg); load(); } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{name}: photo and crew</DialogTitle>
          <DialogDescription className="text-left text-sm">Crew see this boat on their own phones and can tick items. Only you can change anything else.</DialogDescription>
        </DialogHeader>
        <PhotoPicker boat={boat} online={online} onChanged={onPhoto} />
        <form onSubmit={invite} className="flex flex-col gap-2">
          <label className="field-label" htmlFor="crew-email">Invite crew by email</label>
          <div className="flex gap-2">
            <input id="crew-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="crew@email.com"
              className="field-input min-w-0 flex-1 text-base normal-case tracking-normal" data-testid="crew-invite-email-input" />
            <button type="submit" className="btn-solid flex items-center gap-2 px-4" disabled={busy} data-testid="crew-invite-send-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Invite
            </button>
          </div>
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="crew-invite-error">{error}</div>}
        </form>
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-md border-[1.5px] border-[var(--line)]" data-testid="crew-list">
          {info.crew.length + info.invites.length === 0 && <li className="p-3 text-sm text-[var(--muted)]" data-testid="crew-empty">No crew yet.</li>}
          {info.crew.map((m) => (
            <Row key={m.user_id} title={m.name || m.email} sub={m.email} label="Remove from crew" testId={`crew-member-${m.user_id}`}
              onRemove={() => run(() => api.delete(`/boats/${boat.boat_id}/crew/${m.user_id}`), `${m.name || m.email} removed from the crew`)} />
          ))}
          {info.invites.map((i) => (
            <Row key={i.invite_id} title={i.email} sub="Invite sent, waiting to join" label="Cancel invite" testId={`crew-invite-${i.invite_id}`}
              onRemove={() => run(() => api.delete(`/boats/${boat.boat_id}/invites/${i.invite_id}`), "Invite cancelled")} />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
};
