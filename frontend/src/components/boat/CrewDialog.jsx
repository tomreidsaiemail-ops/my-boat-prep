import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Pencil, UserMinus, UserPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { PhotoPicker } from "@/components/boat/PhotoPicker";
import { InviteCrewDialog } from "@/components/boat/InviteCrewDialog";
import { EditRolesDialog } from "@/components/boat/EditRolesDialog";
import { RsvpBadge, RsvpSummary } from "@/components/boat/Rsvp";
import { WatchRotaDialog } from "@/components/boat/WatchRotaDialog";

const Row = ({ title, sub, roles = [], rsvp, onRemove, onEdit, label, testId }) => (
  <li className="flex items-center gap-2 px-3 py-2.5" data-testid={testId}>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold">{title}</p>
      <p className="truncate text-xs text-[var(--muted)]">{sub}</p>
      {(roles.length > 0 || rsvp !== undefined) && (
        <div className="mt-1 flex flex-wrap gap-1" data-testid={`${testId}-roles`}>
          {rsvp !== undefined && <RsvpBadge status={rsvp} testId={`${testId}-rsvp`} />}
          {roles.map((r) => <span key={r} className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-900">{r}</span>)}
        </div>
      )}
    </div>
    {onEdit && (
      <button type="button" className="icon-btn" onClick={onEdit} aria-label="Edit roles" title="Edit roles" data-testid={`${testId}-edit-roles-btn`}>
        <Pencil className="h-[18px] w-[18px]" />
      </button>
    )}
    <button type="button" className="icon-btn hover:text-[var(--red)]" onClick={onRemove} aria-label={label} title={label} data-testid={`${testId}-remove-btn`}>
      {label.startsWith("Cancel") ? <X className="h-[18px] w-[18px]" /> : <UserMinus className="h-[18px] w-[18px]" />}
    </button>
  </li>
);

export const CrewDialog = ({ open, boat, name, online, premium, onUpgrade, onPhoto, onClose }) => {
  const [info, setInfo] = useState({ crew: [], invites: [], role_options: [], voyage_notes: "" });
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [rota, setRota] = useState(false);
  const openRota = () => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { toast.error("You're offline. Make the watch rota when you have signal."); return; }
    setRota(true);
  };
  const saveRoles = async (roles) => {
    if (!online) { toast.error("Go online to change crew roles"); return false; }
    try { await api.put(`/boats/${boat.boat_id}/crew/${editing.user_id}/roles`, { roles }); toast.success("Roles saved"); load(); return true; }
    catch (err) { toast.error(apiError(err, "Couldn't save the roles, please try again")); return false; }
  };

  const load = useCallback(() => api.get(`/boats/${boat.boat_id}/crew`).then(({ data }) => setInfo(data)).catch(() => {}), [boat.boat_id]);
  useEffect(() => { if (open && online) load(); }, [open, online, load]);
  const openInvite = () => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { toast.error("You're offline. Invite crew when you have signal."); return; }
    setInviting(true);
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
        <div className="flex gap-2">
          <button type="button" className="btn-solid h-12 flex-1 justify-center gap-2" onClick={openInvite} data-testid="crew-invite-open-btn">
            <UserPlus className="h-4 w-4" /> Invite crew
          </button>
          <button type="button" className="btn-ghost h-12 flex-1 justify-center gap-2" onClick={openRota} data-testid="watch-rota-open-btn">
            <Clock className="h-4 w-4" /> {info.watch_rota ? "Watch rota" : "Make watch rota"}
          </button>
        </div>
        <RsvpSummary crew={info.crew} onClear={info.voyage_notes || info.crew.some((m) => m.rsvp) ? () => run(() => api.delete(`/boats/${boat.boat_id}/rsvp`), "Replies cleared, ready for your next voyage") : null} />
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-md border-[1.5px] border-[var(--line)]" data-testid="crew-list">
          {info.crew.length + info.invites.length === 0 && <li className="p-3 text-sm text-[var(--muted)]" data-testid="crew-empty">No crew yet.</li>}
          {info.crew.map((m) => (
            <Row key={m.user_id} title={m.name || m.email} sub={m.email} roles={m.roles} rsvp={m.rsvp || null} label="Remove from crew" testId={`crew-member-${m.user_id}`}
              onEdit={() => setEditing(m)}
              onRemove={() => run(() => api.delete(`/boats/${boat.boat_id}/crew/${m.user_id}`), `${m.name || m.email} removed from the crew`)} />
          ))}
          {info.invites.map((i) => (
            <Row key={i.invite_id} title={i.email} sub={i.declined_at ? "Declined the invite" : "Invited, joins when they log in"} roles={i.roles} label="Cancel invite" testId={`crew-invite-${i.invite_id}`}
              onRemove={() => run(() => api.delete(`/boats/${boat.boat_id}/invites/${i.invite_id}`), "Invite cancelled")} />
          ))}
        </ul>
        <InviteCrewDialog open={inviting} boat={boat} name={name} info={info} online={online} premium={premium} onUpgrade={onUpgrade}
          onInvited={load} onClose={() => setInviting(false)} />
        <EditRolesDialog member={editing} options={info.role_options || []} onSave={saveRoles} onClose={() => setEditing(null)} />
        <WatchRotaDialog open={rota} boat={boat} info={info} online={online} onSaved={load} onClose={() => setRota(false)} />
      </DialogContent>
    </Dialog>
  );
};
