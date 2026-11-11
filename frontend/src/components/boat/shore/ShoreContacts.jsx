import { useEffect, useState } from "react";
import { Copy, Loader2, MapPinned, Send, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { AWAKE_KEY } from "@/hooks/useShoreTracking";
import { ShoreStatus } from "@/components/boat/shore/ShoreStatus";

const Switch = ({ checked, onChange, disabled, title, text, testId }) => (
  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border-[1.5px] border-[var(--line)] bg-white px-3 py-2" data-testid={testId}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${testId}-input`} />
    <span className="text-sm"><b>{title}</b><span className="block text-xs text-[var(--muted)]">{text}</span></span>
  </label>
);

const InviteForm = ({ boatId, onSent }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const send = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { toast.error("Enter their name and email"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/boats/${boatId}/shore/invites`, { name: name.trim(), email: email.trim() });
      setLink(data.link);
      toast.success(data.emailed ? `Invite emailed to ${email.trim()}` : "Invite made. Copy the link and send it to them.");
      setName(""); setEmail("");
      onSent();
    } catch (err) { toast.error(apiError(err, "Couldn't make the invite")); }
    setBusy(false);
  };
  return (
    <form onSubmit={send} className="flex flex-col gap-2" data-testid="shore-invite-form">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Their name" className="field-input" data-testid="shore-invite-name" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} placeholder="Their email" className="field-input" data-testid="shore-invite-email" />
      </div>
      <button type="submit" disabled={busy} className="btn-solid min-h-11 justify-center gap-2" data-testid="shore-invite-send-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invite shore contact
      </button>
      {link && (
        <button type="button" className="btn-ghost min-h-10 justify-center gap-2 text-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Invite link copied"))} data-testid="shore-invite-copy-btn">
          <Copy className="h-4 w-4" /> Copy invite link
        </button>
      )}
    </form>
  );
};

// Skipper's Shore Contacts panel under the crew cards: invites, the tracking switch and who is watching.
export const ShoreContacts = ({ boat, online, onTrackingChange }) => {
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
  const remove = async (c) => {
    try { await api.delete(`/boats/${boat.boat_id}/shore/contacts/${c.key}`); load(); toast.success(`${c.name || c.email} removed`); }
    catch (err) { toast.error(apiError(err, "Couldn't remove them")); }
  };
  const keepAwake = (v) => { setAwake(v); localStorage.setItem(AWAKE_KEY, String(v)); window.dispatchEvent(new Event("mbp:track-awake")); };

  if (!online && !info) return <p className="text-sm text-[var(--muted)]" data-testid="shore-contacts-offline">Shore Contacts need a signal to manage.</p>;
  if (!info) return <Loader2 className="h-5 w-5 animate-spin" />;
  const t = info.tracking || {};
  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-[var(--navy)] bg-sky-50/60 p-3" data-testid="shore-contacts">
      <h3 className="flex items-center gap-2 font-display text-base font-extrabold"><MapPinned className="h-5 w-5" /> Shore Contacts</h3>
      <Switch checked={!!t.on} onChange={track} disabled={!online} testId="shore-tracking-switch" title="Share position with shore contacts"
        text="While My Boat Prep is open on a phone aboard, it sends the boat's position every 1 km, or an hourly check-in when anchored. Turn it off at the end of the trip." />
      {t.on && <ShoreStatus status={t} testId="shore-tracking-status" />}
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
      <InviteForm boatId={boat.boat_id} onSent={load} />
    </section>
  );
};
