import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, MapPinned, MessageCircle, Send, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { AWAKE_KEY } from "@/hooks/useShoreTracking";
import { ShoreStatus } from "@/components/boat/shore/ShoreStatus";

const Switch = ({ checked, onChange, disabled, title, text, testId }) => (
  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border-[1.5px] border-[var(--line)] bg-white px-3 py-2" data-testid={testId}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${testId}-input`} />
    <span className="text-sm"><b>{title}</b><span className="block text-xs text-[var(--muted)]">{text}</span></span>
  </label>
);

const shoreMessage = ({ name, email, vessel, link }) =>
  `Hi ${name}, I've added you as the shore contact for ${vessel || "our boat"} on My Boat Prep, so you can see where we are while we're out.\n\nOpen this link and sign in with ${email}:\n${link}`;

const copyText = (text) => navigator.clipboard?.writeText(text).then(() => true).catch(() => false) ?? Promise.resolve(false);

const InviteForm = ({ boatId, vessel, onSent }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const send = async (mode) => {
    if (!name.trim() || !email.trim()) { toast.error("Enter their name and email"); return; }
    setBusy(mode);
    try {
      const { data } = await api.post(`/boats/${boatId}/shore/invites`, { name: name.trim(), email: email.trim(), send_email: mode === "email" });
      setLink(data.link);
      if (mode === "whatsapp") {
        const text = shoreMessage({ name: name.trim(), email: email.trim(), vessel, link: data.link });
        setMessage(text);
        toast.success(await copyText(text) ? "Invite saved and WhatsApp message copied. Paste it into WhatsApp, or tap Open WhatsApp." : "Invite saved. Tap Open WhatsApp, or copy the message below.");
      } else {
        setMessage("");
        toast.success(data.emailed ? `Invite emailed to ${email.trim()}` : "Invite made. Copy the link and send it to them.");
      }
      setName(""); setEmail("");
      onSent();
    } catch (err) { toast.error(apiError(err, "Couldn't make the invite")); }
    setBusy("");
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); send("email"); }} className="flex flex-col gap-2" data-testid="shore-invite-form">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Their name" className="field-input" data-testid="shore-invite-name" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} placeholder="Their email" className="field-input" data-testid="shore-invite-email" />
      </div>
      <button type="submit" disabled={!!busy} className="btn-solid min-h-11 justify-center gap-2" data-testid="shore-invite-send-btn">
        {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send email invite
      </button>
      <button type="button" disabled={!!busy} onClick={() => send("whatsapp")} className="btn-ghost min-h-11 justify-center gap-2" data-testid="shore-invite-whatsapp-btn">
        {busy === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Copy WhatsApp message
      </button>
      {message && (
        <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed border-[var(--line)] bg-white p-3" data-testid="shore-invite-message">
          <span className="field-label">WhatsApp message</span>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm" data-testid="shore-invite-message-text">{message}</pre>
          <div className="flex gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn-solid min-h-10 flex-1 justify-center gap-2 text-sm" data-testid="shore-invite-open-whatsapp"><MessageCircle className="h-4 w-4" /> Open WhatsApp</a>
            <button type="button" className="btn-ghost min-h-10 flex-1 justify-center gap-2 text-sm" onClick={() => copyText(message).then((ok) => (ok ? toast.success("Message copied") : toast.error("Press and hold the message to copy it")))} data-testid="shore-invite-copy-message-btn"><Copy className="h-4 w-4" /> Copy message</button>
          </div>
        </div>
      )}
      {link && !message && (
        <button type="button" className="btn-ghost min-h-10 justify-center gap-2 text-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Invite link copied"))} data-testid="shore-invite-copy-btn">
          <Copy className="h-4 w-4" /> Copy invite link
        </button>
      )}
    </form>
  );
};

// Skipper's Shore Contacts panel under the crew cards: invites, the tracking switch and who is watching.
export const ShoreContacts = ({ boat, vessel, online, onTrackingChange }) => {
  const [info, setInfo] = useState(null);
  const [awake, setAwake] = useState(() => localStorage.getItem(AWAKE_KEY) === "true");
  const load = () => api.get(`/boats/${boat.boat_id}/shore`).then(({ data }) => setInfo(data)).catch(() => setInfo({ contacts: [], tracking: {} }));
  useEffect(() => { if (online) load(); }, [boat.boat_id, online]); // eslint-disable-line react-hooks/exhaustive-deps

  const track = async (on) => {
    try {
      const { data } = await api.put(`/boats/${boat.boat_id}/shore/tracking`, { on });
      setInfo((i) => ({ ...i, tracking: data }));
      onTrackingChange?.({ on: data.on, trip_id: data.trip_id });
      toast.success(on ? "Sharing your position with shore contacts" : "Stopped sharing your position");
    } catch (err) { toast.error(apiError(err, "Couldn't change tracking")); }
  };
  const [arriving, setArriving] = useState(false);
  const arrived = async () => {
    setArriving(true);
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/shore/arrived`);
      setInfo((i) => ({ ...i, tracking: data }));
      onTrackingChange?.({ on: false, trip_id: data.trip_id });
      toast.success(data.told ? `Trip finished. ${data.emailed ? "Emailed" : "Couldn't email, but told"} ${data.told} shore ${data.told === 1 ? "contact" : "contacts"} you arrived safely.` : "Trip finished. Add a shore contact to tell someone next time.");
    } catch (err) { toast.error(apiError(err, "Couldn't finish the trip")); }
    setArriving(false);
  };
  const remove = async (c) => {
    try { await api.delete(`/boats/${boat.boat_id}/shore/contacts/${c.key}`); load(); toast.success(`${c.name || c.email} removed`); }
    catch (err) { toast.error(apiError(err, "Couldn't remove them")); }
  };
  const keepAwake = (v) => { setAwake(v); localStorage.setItem(AWAKE_KEY, String(v)); window.dispatchEvent(new Event("mbp:track-awake")); };

  if (!online && !info) return <p className="text-sm text-[var(--muted)]" data-testid="shore-contacts-offline">Shore Contacts need a signal to manage.</p>;
  if (!info) return <Loader2 className="h-5 w-5 animate-spin" />;
  const t = info.tracking || {};
  return (
    // Everything here saves straight away, so it never counts as unsaved changes when the Crew screen closes.
    <section className="flex flex-col gap-3 rounded-xl border-2 border-[var(--navy)] bg-sky-50/60 p-3" data-no-dirty data-testid="shore-contacts">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-extrabold"><MapPinned className="h-5 w-5" /> Shore Contacts</h3>
        <Link to="/shore" className="btn-ghost min-h-9 shrink-0 gap-1.5 px-3 text-xs" data-testid="shore-monitor-link"><MapPinned className="h-4 w-4" /> Monitor my boats</Link>
      </div>
      <Switch checked={!!t.on} onChange={track} disabled={!online} testId="shore-tracking-switch" title="Share position with shore contacts"
        text="While My Boat Prep is open on a phone aboard, it sends the boat's position every 1 km, or an hourly check-in when anchored. Turn it off at the end of the trip." />
      {(t.on || t.state === "arrived") && <ShoreStatus status={t} testId="shore-tracking-status" />}
      {t.on && (
        <button type="button" onClick={arrived} disabled={!online || arriving} className="btn-solid min-h-12 justify-center gap-2 !bg-emerald-700" data-testid="shore-arrived-btn">
          {arriving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Arrived safely
        </button>
      )}
      <Switch checked={awake} onChange={keepAwake} testId="shore-awake-switch" title="Keep this screen awake while tracking"
        text="Phones pause the app when the screen locks. Leave a phone on charge with this on to keep sending positions." />
      <ul className="flex flex-col gap-1.5" data-testid="shore-contacts-list">
        {info.contacts.length === 0 && <li className="text-sm text-[var(--muted)]" data-testid="shore-contacts-empty">No shore contacts yet.</li>}
        {info.contacts.map((c) => (
          <li key={c.key} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2" data-testid={`shore-contact-${c.key}`}>
            <UserRound className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{c.name || c.email}</span><span className="block truncate text-xs text-[var(--muted)]">{c.email}</span></span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.status === "joined" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`} data-testid={`shore-contact-${c.key}-status`}>{c.status === "joined" ? "Watching" : "Invited"}</span>
            <button type="button" className="icon-btn h-9 w-9 hover:text-[var(--red)]" onClick={() => remove(c)} aria-label={`Remove ${c.name || c.email}`} data-testid={`shore-contact-${c.key}-remove`}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <InviteForm boatId={boat.boat_id} vessel={vessel || boat.vessel} onSent={load} />
    </section>
  );
};
