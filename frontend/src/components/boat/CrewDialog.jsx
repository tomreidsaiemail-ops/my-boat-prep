import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Clock, Loader2, Mail, Pencil, RefreshCw, UserMinus, UserPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { PhotoPicker } from "@/components/boat/PhotoPicker";
import { InviteCrewDialog } from "@/components/boat/InviteCrewDialog";
import { WalkStopsPicker } from "@/components/boat/crew/WalkStopsPicker";
import { EditRolesDialog } from "@/components/boat/EditRolesDialog";
import { RsvpBadge, RsvpSummary } from "@/components/boat/Rsvp";
import { WatchRotaDialog } from "@/components/boat/WatchRotaDialog";
import { INVITE_DRAFT } from "@/lib/crewRoles";
import { AgreementBadge } from "@/components/boat/agreement/AgreementBadge";
import { BoatTermsField } from "@/components/boat/agreement/BoatTermsField";
import { CrewMemberTools } from "@/components/boat/agreement/CrewMemberTools";
import { SendShoppingButton } from "@/components/boat/SendShoppingButton";
import { PrepBadge } from "@/components/boat/CrewPrepProgress";
import { CrewRegisterDialog } from "@/components/boat/register/CrewRegisterDialog";
import { EmailPartiesButton } from "@/components/boat/register/EmailPartiesButton";
import { RegStatus } from "@/components/boat/register/RegStatus";
import { RoleBubble } from "@/components/boat/crew/RoleBubble";
import { CrewFacts, ReadyBadge, readyToSail } from "@/components/boat/crew/CrewFacts";
import { CrewTotals } from "@/components/boat/crew/CrewTotals";

const bubblesFor = (p, joined, testId) => (p.briefings || (p.roles || []).map((role) => ({ role, has_briefing: false })))
  .map((b, k) => <RoleBubble key={b.role} b={b} who={p.name || p.email} joined={joined} testId={`${testId}-role-${k}`} />);

const Row = ({ title, sub, bubbles, rsvp, badge, onRemove, onEdit, label, testId }) => (
  <li className="flex items-center gap-2 px-3 py-2.5" data-testid={testId}>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold">{title}</p>
      <p className="truncate text-xs text-[var(--muted)]">{sub}</p>
      {badge}
      {(bubbles?.length > 0 || rsvp !== undefined) && (
        <div className="mt-1 flex flex-wrap gap-1" data-testid={`${testId}-roles`}>
          {rsvp !== undefined && <RsvpBadge status={rsvp} testId={`${testId}-rsvp`} />}
          {bubbles}
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

export const CrewDialog = ({ open, boat, name, plan, roleGroups = [], briefings = {}, provisions = [], weightBoat, onSaveBriefing, knownRole, startInvite, online, premium, onUpgrade, onPhoto, onClose, areas, onWalkSkip }) => {
  const [info, setInfo] = useState({ crew: [], invites: [], role_options: [], voyage_notes: "" });
  const [inviting, setInviting] = useState(false);
  useEffect(() => { if (open && startInvite) setInviting(true); }, [open, startInvite]);
  const [editing, setEditing] = useState(null);
  const [rota, setRota] = useState(false);
  const [register, setRegister] = useState(false);
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
  const [reg, setReg] = useState({});
  const loadReg = useCallback(() => api.get("/crew-register").then(({ data }) => setReg(Object.fromEntries(data.crew.map((c) => [c.email.toLowerCase(), c])))).catch(() => {}), []);
  useEffect(() => { if (open && online) { load(); loadReg(); } }, [open, online, load, loadReg]);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (!online) { toast.error("Go online to refresh your crew"); return; }
    setRefreshing(true);
    window.dispatchEvent(new Event("mbp:refresh-boat"));
    window.dispatchEvent(new Event("mbp:register-changed"));
    await Promise.all([load(), loadReg()]);
    setRefreshing(false);
    toast.success("Crew, registrations and role briefings refreshed");
  };
  const regBadge = (email, testId) => {
    const r = reg[(email || "").toLowerCase()];
    const walked = r?.walkthroughs?.some((w) => w.boat_id === boat.boat_id);
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        <RegStatus status={r?.status || "unregistered"} testId={`${testId}-reg`} />
        {walked && <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-extrabold text-green-800" data-testid={`${testId}-walkthrough`}>Walkthrough done</span>}
      </div>
    );
  };
  const openInvite = () => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { toast.error("You're offline. Invite crew when you have signal."); return; }
    setInviting(true);
  };
  const run = async (fn, msg) => {
    if (!online) { toast.error("Go online to change your crew"); return; }
    try { await fn(); toast.success(msg); load(); } catch (err) { toast.error(apiError(err)); }
  };
  const [sending, setSending] = useState(null);
  const sendBriefings = async (member) => {
    if (!online) { toast.error("Go online to email role briefings"); return; }
    setSending(member ? member.user_id : "all");
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/briefings`, member ? { member_id: member.user_id } : {}, { timeout: 60000 });
      if (data.sent.length) toast.success(`Role briefing emailed to ${data.sent.join(", ")}`);
      if (data.skipped.length) toast.error(`No briefing to send for ${data.skipped.join(", ")}. Give them a role with a Role Briefing in your Crew Roles list.`);
    } catch (err) { toast.error(apiError(err, "Couldn't email the briefing, please try again")); }
    setSending(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{name}: photo and crew</DialogTitle>
          <DialogDescription className="text-left text-sm">Crew see this boat on their own phones and can tick items. Only you can change anything else.</DialogDescription>
        </DialogHeader>
        <PhotoPicker boat={boat} online={online} onChanged={onPhoto} />
        <button type="button" className="btn-ghost h-12 justify-center gap-2" onClick={() => (online ? setRegister(true) : toast.error("Go online to open Crew Registration"))} data-testid="crew-register-open-btn">
          <ClipboardList className="h-4 w-4" /> Crew Registration
        </button>
        <WalkStopsPicker boat={boat} areas={areas} online={online} onSaved={onWalkSkip} />
        <div className="flex gap-2">
          <button type="button" className="btn-solid h-12 flex-1 justify-center gap-2" onClick={openInvite} data-testid="crew-invite-open-btn">
            <UserPlus className="h-4 w-4" /> Invite crew
          </button>
          <button type="button" className="btn-ghost h-12 flex-1 justify-center gap-2" onClick={openRota} data-testid="watch-rota-open-btn">
            <Clock className="h-4 w-4" /> {info.watch_rota ? "Watch rota" : "Make watch rota"}
          </button>
        </div>
        <RsvpSummary crew={info.crew} onClear={info.voyage_notes || info.crew.some((m) => m.rsvp) ? () => run(() => api.delete(`/boats/${boat.boat_id}/rsvp`), "Replies cleared, ready for your next voyage") : null} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">Check before sailing
            {info.crew.length > 0 && (() => { const n = info.crew.filter((m) => readyToSail(m, reg[(m.email || "").toLowerCase()], provisions)).length; return (
              <span className={`ml-1 normal-case ${n === info.crew.length ? "text-[var(--green)]" : "text-amber-800"}`} data-testid="crew-ready-count">· {n} of {info.crew.length} ready to sail</span>
            ); })()}
          </p>
          <button type="button" className="btn-ghost h-9 gap-1.5 px-3 text-xs" onClick={refresh} disabled={refreshing} data-testid="crew-refresh-btn">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <CrewTotals crew={info.crew} invites={info.invites} reg={reg} boat={weightBoat} />
        <ul className="shrink-0 divide-y divide-[var(--line)] overflow-hidden rounded-md border-[1.5px] border-[var(--line)]" data-testid="crew-list">
          {info.crew.length + info.invites.length === 0 && <li className="p-3 text-sm text-[var(--muted)]" data-testid="crew-empty">No crew yet.</li>}
          {info.crew.map((m) => (
            <Row key={m.user_id} title={m.name || m.email} sub={m.email} bubbles={bubblesFor(m, true, `crew-member-${m.user_id}`)} rsvp={m.rsvp || null} label="Remove from crew" testId={`crew-member-${m.user_id}`}
              badge={<>
                {readyToSail(m, reg[(m.email || "").toLowerCase()], provisions) && <><ReadyBadge testId={`crew-member-${m.user_id}-ready`} /><br /></>}
                {regBadge(m.email, `crew-member-${m.user_id}`)}
                <CrewFacts person={m} reg={reg[(m.email || "").toLowerCase()]} joined provisions={provisions} testId={`crew-member-${m.user_id}`} />
                <AgreementBadge agreement={m.agreement} testId={`crew-member-${m.user_id}-agreement`} />
                <PrepBadge prep={m.prep} testId={`crew-member-${m.user_id}-prep`} />
                <CrewMemberTools boat={boat} member={m} online={online} sending={sending} onBriefing={sendBriefings} testId={`crew-member-${m.user_id}`} />
                <SendShoppingButton boat={boat} vessel={name} person={{ name: m.name, email: m.email }} provisions={provisions} online={online} testId={`crew-member-${m.user_id}`} />
              </>}
              onEdit={() => setEditing(m)}
              onRemove={() => run(() => api.delete(`/boats/${boat.boat_id}/crew/${m.user_id}`), `${m.name || m.email} removed from the crew`)} />
          ))}
          {info.invites.map((i) => (
            <Row key={i.invite_id} title={i.name || i.email} sub={i.declined_at ? `${i.email} · Declined the invite` : i.email} bubbles={bubblesFor(i, false, `crew-invite-${i.invite_id}`)} label="Cancel invite" testId={`crew-invite-${i.invite_id}`}
              badge={<>{regBadge(i.email, `crew-invite-${i.invite_id}`)}<CrewFacts person={i} reg={reg[(i.email || "").toLowerCase()]} joined={false} provisions={provisions} testId={`crew-invite-${i.invite_id}`} />
                <PrepBadge prep={i.prep} testId={`crew-invite-${i.invite_id}-prep`} />
                <SendShoppingButton boat={boat} vessel={name} person={{ name: i.name, email: i.email }} provisions={provisions} online={online} testId={`crew-invite-${i.invite_id}`} /></>}
              onRemove={() => run(() => api.delete(`/boats/${boat.boat_id}/invites/${i.invite_id}`), "Invite cancelled")} />
          ))}
        </ul>
        {info.crew.length > 1 && (
          <button type="button" className="btn-ghost h-11 justify-center gap-2" onClick={() => sendBriefings(null)} disabled={!!sending || !online} data-testid="crew-briefings-all-btn">
            {sending === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Resend role briefings to all crew
          </button>
        )}
        <EmailPartiesButton boatId={boat.boat_id} online={online} premium={premium} onUpgrade={onUpgrade} testId="crew-email-parties-btn" />
        <BoatTermsField boat={boat} value={info.boat_terms || ""} online={online} onSaved={load} />
        <InviteCrewDialog open={inviting} boat={boat} name={name} info={info} plan={plan} roleGroups={roleGroups} briefings={briefings} provisions={provisions} onSaveBriefing={onSaveBriefing} knownRole={knownRole} online={online} premium={premium} onUpgrade={onUpgrade}
          onInvited={load} onClose={() => setInviting(false)}
          onChangeAvailable={(draft) => {
            sessionStorage.setItem(INVITE_DRAFT, JSON.stringify(draft));
            setInviting(false);
            onClose();
            window.dispatchEvent(new Event("mbp:crew-roles"));
          }} />
        <EditRolesDialog member={editing} groups={roleGroups} options={info.role_options || []} onSave={saveRoles} onClose={() => setEditing(null)} />
        <CrewRegisterDialog open={register} boatId={boat.boat_id} online={online} premium={premium} onUpgrade={onUpgrade} onClose={() => { setRegister(false); loadReg(); window.dispatchEvent(new Event("mbp:register-changed")); }} />
        <WatchRotaDialog open={rota} boat={boat} info={info} online={online} onSaved={load} onClose={() => setRota(false)} />
      </DialogContent>
    </Dialog>
  );
};
