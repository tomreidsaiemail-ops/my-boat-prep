import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, Mail, MessageCircle, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { RolePicker } from "@/components/boat/RolePicker";
import { RsvpSummary } from "@/components/boat/Rsvp";
import { INVITE_DRAFT } from "@/lib/crewRoles";
import { RegisterPicker } from "@/components/boat/register/RegisterPicker";

const APP_URL = "https://myboatprep.com";

export const crewMessage = ({ vessel, skipper, roles, notes, email, name, briefings = {} }) => [
  `*${name ? `Hi ${name}, you're` : "You're"} invited to crew on ${vessel}*`,
  `Skipper: ${skipper}`,
  roles.length ? `Your role: ${roles.join(", ")}` : null,
  ...roles.filter((r) => briefings[r.toLowerCase()]).map((r) => `\n*Role briefing - ${r}*\n${briefings[r.toLowerCase()]}`),
  notes.trim() ? `\n*Planned voyage or race*\n${notes.trim()}` : null,
  `\nJoin on My Boat Prep: ${APP_URL}`,
  `Sign up or log in with ${email || "your email"} and the app will ask you to join ${vessel}.`,
].filter(Boolean).join("\n");

const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };

export const InviteCrewDialog = ({ open, boat, name, info, plan = "", roleGroups = [], briefings = {}, online, premium, onUpgrade, onInvited, onClose, onChangeAvailable }) => {
  const { user } = useAuth();
  const [crewName, setCrewName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState([]);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [qrFor, setQrFor] = useState("");
  const [askClear, setAskClear] = useState("");
  // The draft from "Change available" stays until the invite is sent or closed, so a second run of this effect still finds it.
  // Notes stick with the boat between invites; with none saved yet they're suggested from Route Planning.
  useEffect(() => {
    if (!open) return;
    const draft = JSON.parse(sessionStorage.getItem(INVITE_DRAFT) || "null");
    setCrewName(draft?.name || ""); setEmail(draft?.email || ""); setRoles(draft?.roles || []); setError(""); setQrFor(""); setAskClear(""); setNotes((draft && draft.notes) || info.voyage_notes || plan); setTouched(!!draft?.notes);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && !touched) setNotes(info.voyage_notes || plan); }, [info.voyage_notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const editNotes = (v) => { setTouched(true); setNotes(v); };

  const message = crewMessage({ vessel: name, skipper: user.name || user.email, roles, notes, email: email.trim(), name: crewName.trim(), briefings });
  // The briefings on this phone go with the invite, so a briefing typed moments ago is in the email even before it has synced.
  const mine = Object.fromEntries(roles.filter((r) => briefings[r.toLowerCase()]).map((r) => [r.slice(0, 40), briefings[r.toLowerCase()].slice(0, 2000)]));
  const saveNotes = () => { if (online && notes.trim() !== (info.voyage_notes || "")) api.put(`/boats/${boat.boat_id}/voyage-notes`, { notes }).then(onInvited).catch(() => {}); };

  const send = async (mode) => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { setError("You're offline. Invite crew when you have signal."); return; }
    if (!crewName.trim()) { setError("Enter your crew member's name first"); return; }
    if (!email.trim()) { setError("Enter your crew member's email first, so the app knows them when they log in"); return; }
    const copied = mode === "email" || mode === "qr" ? true : await copy(mode === "link" ? APP_URL : message);
    setBusy(mode); setError("");
    try {
      await api.post(`/boats/${boat.boat_id}/invites`, { name: crewName.trim(), email: email.trim(), roles, notes, briefings: mine, send_email: mode === "email" }, { timeout: 30000 });
      const who = email.trim();
      sessionStorage.removeItem(INVITE_DRAFT);
      if (mode === "qr") setQrFor(who);
      else if (mode === "email") toast.success(`Invite emailed to ${who}. They just log in to join.`);
      else if (copied) toast.success(mode === "link" ? `Link copied. ${who} logs in with that email to join.` : "Message copied. Paste it into WhatsApp or any messaging app.");
      else toast.message("Invite saved. Copying isn't allowed here, so press and hold the message to copy it.");
      if (copied) setAskClear(who);
      onInvited({ name: crewName.trim(), email: who });
    } catch (err) { setError(apiError(err, "Couldn't save the invite, please try again")); }
    finally { setBusy(""); }
  };
  const Btn = ({ mode, icon: Icon, children, solid }) => (
    <button type="button" className={`${solid ? "btn-solid" : "btn-ghost"} h-12 w-full justify-center gap-2`} disabled={!!busy} onClick={() => send(mode)} data-testid={`crew-invite-${mode}-btn`}>
      {busy === mode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {children}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { sessionStorage.removeItem(INVITE_DRAFT); onClose(); } }}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="invite-crew-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Invite crew to {name}</DialogTitle>
          <DialogDescription className="text-left text-sm">They join by logging in to My Boat Prep with this email. No link to click.</DialogDescription>
        </DialogHeader>
        <RegisterPicker open={open} online={online} email={email} onPick={(c) => { setCrewName(c.name.slice(0, 60)); setEmail(c.email); setError(""); setAskClear(""); }} />
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[2fr_3fr] items-end gap-2" data-testid="crew-invite-who-row">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="field-label">Crew member's name</span>
              <input autoComplete="off" value={crewName} maxLength={60} onChange={(e) => { setCrewName(e.target.value); setError(""); setAskClear(""); }} placeholder="e.g. Tom"
                className="field-input text-base normal-case tracking-normal" data-testid="crew-invite-name-input" />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="field-label">Crew member's email</span>
              <input id="crew-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); setAskClear(""); }} placeholder="crew@email.com"
                className="field-input text-base normal-case tracking-normal" data-testid="crew-invite-email-input" />
            </label>
          </div>
          {askClear && (
            <div role="alertdialog" aria-label="Clear email?" className="flex flex-col gap-2 rounded-md border-[1.5px] border-[var(--navy)] bg-sky-50 p-2.5" data-testid="crew-invite-clear-prompt">
              <p className="text-sm">Invite saved for <b className="break-all">{askClear}</b>. Clear their name, email and roles for your next invite?</p>
              <div className="flex gap-2">
                <button type="button" className="btn-solid h-10 flex-1 justify-center" onClick={() => { setCrewName(""); setEmail(""); setRoles([]); setAskClear(""); }} data-testid="crew-invite-clear-yes-btn">Clear</button>
                <button type="button" className="btn-ghost h-10 flex-1 justify-center" onClick={() => setAskClear("")} data-testid="crew-invite-clear-keep-btn">Keep</button>
              </div>
            </div>
          )}
        </div>
        <RolePicker groups={roleGroups} options={info.role_options || []} selected={roles} onChange={setRoles}
          onChangeAvailable={onChangeAvailable && (() => { saveNotes(); onChangeAvailable({ name: crewName, email, roles, notes }); })} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end justify-between gap-2">
            <label className="field-label" htmlFor="voyage-notes">Planned voyage or race notes</label>
            {plan && notes !== plan && (
              <button type="button" className="text-xs font-bold text-[var(--navy)] underline underline-offset-2" onClick={() => { editNotes(plan); }} data-testid="voyage-notes-fill-btn">Fill from Route Planning</button>
            )}
          </div>
          <textarea id="voyage-notes" value={notes} onChange={(e) => editNotes(e.target.value)} onBlur={saveNotes} maxLength={1000} rows={6}
            placeholder="Tentative dates, planned crew, crew confirmation status, extra crew needed"
            className="field-input !h-auto min-h-[9rem] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="voyage-notes-input" />
          <p className="text-xs text-[var(--muted)]">Suggested from Route Planning and saved with the boat, so your next invite starts with the same notes. Crew who have joined see these notes and can reply.</p>
        </div>
        <RsvpSummary crew={info.crew || []} />
        {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="crew-invite-error">{error}</div>}
        {qrFor && (
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-[var(--navy)] bg-white p-4 text-center" data-testid="crew-invite-qr-panel">
            <div className="rounded-md bg-white p-2" data-testid="crew-invite-qr">
              <QRCodeSVG value={APP_URL} size={200} level="M" marginSize={1} fgColor="#0f172a" bgColor="#ffffff" title="QR code for myboatprep.com" />
            </div>
            <p className="text-sm">Scan with the phone camera, then log in with<br /><b className="break-all" data-testid="crew-invite-qr-email">{qrFor}</b><br />and the app asks them to join {name}.</p>
            <button type="button" className="btn-ghost h-11 w-full justify-center" onClick={() => setQrFor("")} data-testid="crew-invite-qr-done-btn">Done, invite someone else</button>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Btn mode="email" icon={Mail} solid>Send email invite</Btn>
          <Btn mode="qr" icon={QrCode}>Show QR code to scan</Btn>
          <Btn mode="message" icon={MessageCircle}>Copy WhatsApp message</Btn>
          <Btn mode="link" icon={Link2}>Copy link only</Btn>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="field-label">WhatsApp message preview</span>
          <pre className="whitespace-pre-wrap break-words rounded-md border-[1.5px] border-dashed border-[var(--line)] bg-slate-50 p-3 font-sans text-sm" data-testid="crew-message-preview">{message}</pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};
