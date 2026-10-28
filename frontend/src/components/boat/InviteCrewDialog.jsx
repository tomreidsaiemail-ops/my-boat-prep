import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, Mail, MessageCircle, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { RolePicker } from "@/components/boat/RolePicker";
import { RsvpSummary } from "@/components/boat/Rsvp";

const APP_URL = "https://myboatprep.com";

export const crewMessage = ({ vessel, skipper, roles, notes, email }) => [
  `*You're invited to crew on ${vessel}*`,
  `Skipper: ${skipper}`,
  roles.length ? `Your role: ${roles.join(", ")}` : null,
  notes.trim() ? `\n*Planned voyage*\n${notes.trim()}` : null,
  `\nJoin on My Boat Prep: ${APP_URL}`,
  `Sign up or log in with ${email || "your email"} and the app will ask you to join ${vessel}.`,
].filter(Boolean).join("\n");

const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };

export const InviteCrewDialog = ({ open, boat, name, info, online, premium, onUpgrade, onInvited, onClose }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [qrFor, setQrFor] = useState("");
  useEffect(() => { if (open) { setEmail(""); setRoles([]); setError(""); setQrFor(""); setNotes(info.voyage_notes || ""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const message = crewMessage({ vessel: name, skipper: user.name || user.email, roles, notes, email: email.trim() });
  const saveNotes = () => { if (online && notes.trim() !== (info.voyage_notes || "")) api.put(`/boats/${boat.boat_id}/voyage-notes`, { notes }).then(onInvited).catch(() => {}); };

  const send = async (mode) => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { setError("You're offline. Invite crew when you have signal."); return; }
    if (!email.trim()) { setError("Enter your crew member's email first, so the app knows them when they log in"); return; }
    const copied = mode === "email" || mode === "qr" ? true : await copy(mode === "link" ? APP_URL : message);
    setBusy(mode); setError("");
    try {
      await api.post(`/boats/${boat.boat_id}/invites`, { email: email.trim(), roles, notes, send_email: mode === "email" }, { timeout: 30000 });
      const who = email.trim();
      if (mode === "qr") setQrFor(who);
      else if (mode === "email") toast.success(`Invite emailed to ${who}. They just log in to join.`);
      else if (copied) toast.success(mode === "link" ? `Link copied. ${who} logs in with that email to join.` : "Message copied. Paste it into WhatsApp or any messaging app.");
      else toast.message("Invite saved. Copying isn't allowed here, so press and hold the message to copy it.");
      if (copied) { setEmail(""); setRoles([]); }
      onInvited();
    } catch (err) { setError(apiError(err, "Couldn't save the invite, please try again")); }
    finally { setBusy(""); }
  };
  const Btn = ({ mode, icon: Icon, children, solid }) => (
    <button type="button" className={`${solid ? "btn-solid" : "btn-ghost"} h-12 w-full justify-center gap-2`} disabled={!!busy} onClick={() => send(mode)} data-testid={`crew-invite-${mode}-btn`}>
      {busy === mode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {children}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="invite-crew-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Invite crew to {name}</DialogTitle>
          <DialogDescription className="text-left text-sm">They join by logging in to My Boat Prep with this email. No link to click.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="crew-email">Crew member's email</label>
          <input id="crew-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="crew@email.com"
            className="field-input text-base normal-case tracking-normal" data-testid="crew-invite-email-input" />
        </div>
        <RolePicker options={info.role_options || []} selected={roles} onChange={setRoles} />
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="voyage-notes">Planned voyage notes</label>
          <textarea id="voyage-notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} maxLength={1000} rows={3}
            placeholder="Tentative dates, planned crew, crew confirmation status, extra crew needed"
            className="field-input h-auto resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="voyage-notes-input" />
          <p className="text-xs text-[var(--muted)]">Saved with the boat, ready for your next invite. Crew who have joined see these notes and can reply.</p>
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
