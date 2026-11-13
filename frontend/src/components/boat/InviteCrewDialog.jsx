import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, Mail, MessageCircle, QrCode, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { shoppingFor } from "@/lib/shoppers";
import { RolePicker } from "@/components/boat/RolePicker";
import { RsvpSummary } from "@/components/boat/Rsvp";
import { INVITE_DRAFT } from "@/lib/crewRoles";
import { RegisterPicker } from "@/components/boat/register/RegisterPicker";
import { BRIEFING_PROMPT_KEY, briefingPromptOn, RoleBriefingPrompt } from "@/components/boat/RoleBriefingPrompt";
import { InviteCloseCheck } from "@/components/boat/crew/InviteCloseCheck";
import { DEFAULT_TRIP } from "@/lib/trips";
import { JOINCREW_OFFER } from "@/lib/joincrew";
import { CrewWalkStops } from "@/components/boat/crew/CrewWalkStops";

const APP_URL = "https://myboatprep.com";

export const crewMessage = ({ vessel, skipper, roles, notes, email, name, briefings = {}, shopping = [], offer = false }) => [
  `*${name ? `Hi ${name}, you're` : "You're"} invited to crew on ${vessel}*`,
  `Skipper: ${skipper}`,
  roles.length ? `Your role: ${roles.join(", ")}` : null,
  ...roles.filter((r) => briefings[r.toLowerCase()]).map((r) => `\n*Role briefing - ${r}*\n${briefings[r.toLowerCase()]}`),
  shopping.length ? `\n*Food to bring on board*\n${shopping.map((i) => `- ${i}`).join("\n")}` : null,
  notes.trim() ? `\n*Planned voyage or race*\n${notes.trim()}` : null,
  `\nJoin on My Boat Prep: ${APP_URL}`,
  offer ? JOINCREW_OFFER : null,
  `Sign up or log in with ${email || "your email"} and the app will ask you to join ${vessel}.`,
].filter(Boolean).join("\n");

const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };

export const InviteCrewDialog = ({ open, boat, areas = [], name, info, plan = "", trips = [], roleGroups = [], briefings = {}, provisions = [], knownRole, onSaveBriefing, online, premium, onUpgrade, onInvited, onClose, onChangeAvailable }) => {
  const { user } = useAuth();
  const [crewName, setCrewName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState([]);
  const [notes, setNotes] = useState("");
  const [trip, setTrip] = useState(DEFAULT_TRIP);
  const [walkSkip, setWalkSkip] = useState(null);
  const ownWalk = walkSkip ? { walk_skip: walkSkip } : {};
  const cur = trips.find((t) => t.id === trip) || { id: trip, name: "Route Planning", plan };
  const savedFor = (id) => (id === DEFAULT_TRIP ? info.voyage_notes : info.trip_notes?.[id]) || "";
  const planFor = (id) => (trips.find((t) => t.id === id) || { plan }).plan || "";
  const tripPlan = cur.plan ?? plan;
  // The trip picked last time sticks for the next invite on this boat.
  const tripKey = `mbp_invite_trip_${boat?.owner_id || "own"}_${boat?.boat_id}`;
  // The picker shows on the first invite each session; after a trip is picked or an invite sent it just names the trip, with Change.
  const pickedKey = `${tripKey}_session`;
  const [choosing, setChoosing] = useState(false);
  const keepTrip = () => sessionStorage.setItem(pickedKey, "1");
  const pickTrip = (id) => { localStorage.setItem(tripKey, id); keepTrip(); setTrip(id); setNotes(savedFor(id) || planFor(id)); setTouched(false); setError(""); };
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [qrFor, setQrFor] = useState("");
  // Invites saved while this window is open: who, and whether only a message was copied (so it still has to be sent).
  const [sent, setSent] = useState({});
  const [check, setCheck] = useState(null);
  const [askClear, setAskClear] = useState("");
  const [prompt, setPrompt] = useState(briefingPromptOn);
  const [queue, setQueue] = useState([]);
  const pickRoles = (next) => {
    const added = next.filter((r) => !roles.includes(r));
    setRoles(next);
    if (prompt && onSaveBriefing) setQueue((q) => [...q.filter((r) => next.includes(r)), ...added.filter((r) => !q.includes(r))]);
  };
  const togglePrompt = (on) => { setPrompt(on); localStorage.setItem(BRIEFING_PROMPT_KEY, on ? "1" : "0"); };
  const asking = queue[0] || "";
  const nextPrompt = () => setQueue((q) => q.slice(1));
  // The draft from "Change available" stays until the invite is sent or closed, so a second run of this effect still finds it.
  // Notes stick with the boat between invites; with none saved yet they're suggested from Route Planning.
  useEffect(() => {
    if (!open) return;
    setQueue([]); setSent({}); setCheck(null); setWalkSkip(null); setChoosing(!sessionStorage.getItem(pickedKey));
    const draft = JSON.parse(sessionStorage.getItem(INVITE_DRAFT) || "null");
    const kept = localStorage.getItem(tripKey);
    const t = trips.some((x) => x.id === draft?.trip) ? draft.trip : trips.some((x) => x.id === kept) ? kept : trips[0]?.id || DEFAULT_TRIP;
    setTrip(t);
    setCrewName(draft?.name || ""); setEmail(draft?.email || ""); setRoles(draft?.roles || []); setError(""); setQrFor(""); setAskClear(""); setNotes((draft && draft.notes) || savedFor(t) || planFor(t)); setTouched(!!draft?.notes);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && !touched) setNotes(savedFor(trip) || tripPlan); }, [info.voyage_notes, info.trip_notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const editNotes = (v) => { setTouched(true); setNotes(v); };

  const shopping = shoppingFor(provisions, crewName);
  const message = crewMessage({ vessel: name, skipper: user.name || user.email, roles, notes, email: email.trim(), name: crewName.trim(), briefings, shopping, offer: !!info.joincrew_live });
  // The briefings on this phone go with the invite, so a briefing typed moments ago is in the email even before it has synced.
  const mine = Object.fromEntries(roles.filter((r) => briefings[r.toLowerCase()]).map((r) => [r.slice(0, 40), briefings[r.toLowerCase()].slice(0, 2000)]));
  const saveNotes = () => { if (online && notes.trim() !== savedFor(trip)) api.put(`/boats/${boat.boat_id}/voyage-notes`, { notes, trip_id: trip }).then(onInvited).catch(() => {}); };
  // One join request at a time: a registered crew member still to answer another trip's invite can't be asked again yet.
  const [picked, setPicked] = useState(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const quick = async () => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { setError("You're offline. Invite crew when you have signal."); return; }
    if (!picked || (picked.email || "").toLowerCase() !== email.trim().toLowerCase()) { setError("Pick a registered crew member at the top first, then tap Quick Invite"); return; }
    setQuickBusy(true); setError("");
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/quick-invite`, { entry_id: picked.entry_id, trip_id: trip, trip_name: cur.name, roles, ...ownWalk }, { timeout: 30000 });
      keepTrip();
      toast.success(`${picked.name} is in for ${cur.name} (Quick Invite)${data.joined ? "" : ". They join the moment they first sign in"}. Nothing was sent to them.`);
      sessionStorage.removeItem(INVITE_DRAFT);
      setCrewName(""); setEmail(""); setRoles([]); setPicked(null);
      onInvited({ name: picked.name, email: picked.email });
    } catch (err) { setError(apiError(err, "Couldn't Quick Invite them, please try again")); }
    finally { setQuickBusy(false); }
  };
  const waitingOn = (mail) => (info.invites || []).find((i) => !i.declined_at && (i.email || "").toLowerCase() === mail.toLowerCase() && (i.trip_id || DEFAULT_TRIP) !== trip);

  const send = async (mode) => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { setError("You're offline. Invite crew when you have signal."); return; }
    if (!crewName.trim()) { setError("Enter your crew member's name first"); return; }
    if (!email.trim()) { setError("Enter your crew member's email first, so the app knows them when they log in"); return; }
    const copied = mode === "email" || mode === "qr" ? true : await copy(mode === "link" ? APP_URL : message);
    setBusy(mode); setError("");
    try {
      await api.post(`/boats/${boat.boat_id}/invites`, { name: crewName.trim(), email: email.trim(), roles, notes, briefings: mine, shopping, send_email: mode === "email", trip_id: trip, trip_name: cur.name, ...ownWalk }, { timeout: 30000 });
      const who = email.trim();
      sessionStorage.removeItem(INVITE_DRAFT);
      keepTrip();
      setSent((s) => ({ ...s, [who.toLowerCase()]: { email: who, toSend: mode === "message" || mode === "link" ? !(s[who.toLowerCase()]?.toSend === false) : false } }));
      if (mode === "qr") setQrFor(who);
      else if (mode === "email") toast.success(`Invite emailed to ${who}. They just log in to join.`);
      else if (copied) toast.success(mode === "link" ? `Invite saved and link copied. ${who} logs in with that email to join.` : `Invite saved, no email sent. Message copied: paste it into WhatsApp and send it to ${crewName.trim() || who}.`);
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

  const closeNow = () => { setCheck(null); sessionStorage.removeItem(INVITE_DRAFT); onClose(); };
  const tryClose = () => {
    const typed = crewName.trim() || email.trim();
    const unsaved = typed && !sent[email.trim().toLowerCase()] ? crewName.trim() || email.trim() : "";
    const pending = Object.values(sent).filter((s) => s.toSend).map((s) => s.email);
    if (unsaved || pending.length) setCheck({ unsaved, pending }); else closeNow();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) tryClose(); }}>
      <DialogContent guard={false} className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="invite-crew-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Invite crew to {name}</DialogTitle>
          <DialogDescription className="text-left text-sm">They join by logging in to My Boat Prep with this email. No link to click.</DialogDescription>
        </DialogHeader>
        {trips.length > 1 && !choosing && (
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm" data-testid="crew-invite-trip-sticky">
            <span className="field-label">Trip:</span> <b data-testid="crew-invite-trip-name">{cur.name}</b>
            <button type="button" onClick={() => setChoosing(true)} className="text-xs font-bold text-[var(--navy)] underline underline-offset-2" data-testid="crew-invite-trip-change-btn">Change</button>
          </p>
        )}
        {trips.length > 1 && choosing && (
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Which trip (Route Planning list)?</span>
            <select value={trip} data-no-dirty onChange={(e) => pickTrip(e.target.value)} className="field-input text-base normal-case tracking-normal" data-testid="crew-invite-trip-select">
              {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}
        <RegisterPicker open={open} online={online} email={email} onPick={(c) => {
          const w = waitingOn(c.email || "");
          if (w) { toast.warning(`${c.name || c.email} has yet to respond to the first join request (${w.trip_name || "Route Planning"}). Once they join, you can ask them to join another trip.`, { duration: 7000 }); return; }
          setCrewName(c.name.slice(0, 60)); setEmail(c.email); setError(""); setAskClear(""); setPicked(c); }} />
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
        <RolePicker groups={roleGroups} options={info.role_options || []} selected={roles} onChange={pickRoles}
          onChangeAvailable={onChangeAvailable && (() => { saveNotes(); onChangeAvailable({ name: crewName, email, roles, notes, trip }); })} />
        {onSaveBriefing && (
          <label className="-mt-2 flex items-start gap-2 text-sm font-semibold text-[var(--navy)]" data-testid="role-briefing-toggle">
            <input type="checkbox" data-no-dirty checked={prompt} onChange={(e) => togglePrompt(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="role-briefing-toggle-input" />
            As Roles are clicked &amp; added, show Role Briefing
          </label>
        )}
        <RoleBriefingPrompt role={asking} current={briefings[asking.toLowerCase()] || ""} isNew={!!asking && knownRole && !knownRole(asking)} onSkip={nextPrompt}
          onSave={(text) => { onSaveBriefing(asking, text); nextPrompt(); }} />
        <CrewWalkStops boat={boat} areas={areas} skip={walkSkip} onChange={setWalkSkip} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end justify-between gap-2">
            <label className="field-label" htmlFor="voyage-notes">Planned voyage or race notes</label>
            {tripPlan && notes !== tripPlan && (
              <button type="button" className="text-xs font-bold text-[var(--navy)] underline underline-offset-2" onClick={() => { editNotes(tripPlan); }} data-testid="voyage-notes-fill-btn">Fill from {cur.name}</button>
            )}
          </div>
          <textarea id="voyage-notes" data-no-dirty value={notes} onChange={(e) => editNotes(e.target.value)} onBlur={saveNotes} maxLength={1000} rows={6}
            placeholder="Tentative dates, planned crew, crew confirmation status, extra crew needed"
            className="field-input !h-auto min-h-[9rem] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="voyage-notes-input" />
          <p className="text-xs text-[var(--muted)]">Suggested from Route Planning and saved with the boat, so your next invite starts with the same notes. Crew who have joined see these notes and can reply.</p>
        </div>
        <RsvpSummary crew={(info.crew || []).filter((m) => (m.trips || [DEFAULT_TRIP]).includes(trip)).map((m) => ({ ...m, rsvp: m.trip_rsvp?.[trip] || null }))} title={trips.length > 1 ? `${cur.name} replies` : undefined} />
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
          <button type="button" className="btn-ghost h-12 w-full justify-center gap-2 border-[var(--green)] text-emerald-800" disabled={!!busy || quickBusy} onClick={quick} data-testid="crew-invite-quick-btn">
            {quickBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Quick Invite
          </button>
          <p className="text-xs text-[var(--muted)]" data-testid="crew-invite-quick-hint">Quick Invite: pick a registered crew member at the top. They&apos;re added as joined and &quot;I&apos;m in&quot; for this trip, with the walkthrough pending. Nothing is sent to them.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="field-label">WhatsApp message preview</span>
          <pre className="whitespace-pre-wrap break-words rounded-md border-[1.5px] border-dashed border-[var(--line)] bg-slate-50 p-3 font-sans text-sm" data-testid="crew-message-preview">{message}</pre>
        </div>
        <button type="button" className="btn-solid h-12 w-full justify-center" onClick={tryClose} data-testid="crew-invite-done-btn">Done</button>
        <InviteCloseCheck check={check} onKeep={() => setCheck(null)} onClose={closeNow} />
      </DialogContent>
    </Dialog>
  );
};
