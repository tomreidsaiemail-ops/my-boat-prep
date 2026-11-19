import { useState } from "react";
import { toast } from "sonner";
import { Footprints, Loader2, PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { CrewWalkthrough, walkSteps } from "@/components/boat/CrewWalkthrough";
import { localWhen, timeAgo } from "@/lib/timeAgo";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { AcceptButtons, AgreementWalkthrough, stopId } from "@/components/boat/agreement/AgreementParts";
import { JoinCrewOffer, offerToast } from "@/components/boat/agreement/JoinCrewOffer";
import { Done, ReadTick, TripPlanSection } from "@/components/boat/agreement/AgreementSections";

const Section = ({ title, children, testId }) => (
  <section className="flex flex-col gap-1.5" data-testid={testId}>
    <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">{title}</h3>
    {children}
  </section>
);

const Lines = ({ lines, testId }) => (
  <ul className="flex flex-col gap-1 text-sm leading-snug" data-testid={testId}>
    {lines.map((l, k) => <li key={k} className={`relative pl-4 before:absolute before:left-0 before:content-['•'] ${l.indent ? "ml-4" : ""}`}>{l.label}</li>)}
  </ul>
);

const VIDEO_CHOICES = [["watched", "I have watched the briefing video"], ["will_watch", "I will watch the briefing video before we leave"], ["no_time", "I won't have time to watch the briefing video"]];
export const videoChoiceText = (v) => (VIDEO_CHOICES.find(([k]) => k === v) || [])[1] || "";

const VideoChoices = ({ k, value, onChange }) => (
  <fieldset className="flex flex-col gap-1 rounded-md border-[1.5px] border-[var(--line)] bg-white p-2" data-testid={`agreement-role-${k}-video-choices`}>
    <legend className="px-1 text-xs font-bold text-[var(--muted)]">Pick one</legend>
    {VIDEO_CHOICES.map(([v, label]) => (
      <label key={v} className="flex items-center gap-2 text-sm font-semibold">
        <input type="radio" name={`video-${k}`} checked={value === v} onChange={() => onChange(v)} className="h-4 w-4 accent-[var(--navy)]" data-testid={`agreement-role-${k}-video-${v}`} />{label}
      </label>
    ))}
  </fieldset>
);

const Role = ({ r, k, onRead, busy }) => {
  const [choice, setChoice] = useState("");
  const need = !!r.video && !choice;
  // Once read, the briefing folds away to its name and tick.
  if (r.briefing && r.read_at) return (
    <div className="flex flex-col gap-1.5 rounded-md bg-sky-50 p-2.5 text-sm" data-testid={`agreement-role-${k}`}>
      <b>{r.role}</b>
      <ReadTick checked disabled onChange={() => {}} testId={`agreement-role-${k}-read`}>I&apos;ve read the {r.role} briefing</ReadTick>
      <span className="text-xs text-[var(--muted)]">Read {new Date(r.read_at).toLocaleDateString()}{r.video_choice ? ` · ${videoChoiceText(r.video_choice)}` : ""}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-sky-50 p-2.5 text-sm" data-testid={`agreement-role-${k}`}>
      <b>{r.role}</b>
      <p className="whitespace-pre-wrap" data-testid={`agreement-role-${k}-briefing`}>{r.briefing || "No briefing from the skipper for this role yet."}</p>
      {r.video && <a href={r.video} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start font-bold text-red-700 underline" data-testid={`agreement-role-${k}-video-link`}><PlayCircle className="h-4 w-4" /> Watch the briefing video</a>}
      {r.briefing && (<>
            <label className={`flex items-center gap-2 self-start rounded-md border-[1.5px] border-[var(--navy)] bg-white px-2.5 py-1.5 text-sm font-bold ${need ? "opacity-60" : ""}`} data-testid={`agreement-role-${k}-read-btn`}>
              {busy === r.role ? <Loader2 className="h-5 w-5 animate-spin" /> : <input type="checkbox" checked={false} disabled={need} onChange={() => onRead(r.role, choice)} className="h-5 w-5 accent-emerald-700" data-testid={`agreement-role-${k}-read-checkbox`} />}
              I&apos;ve read the {r.role} briefing
            </label>
            {r.video && <VideoChoices k={k} value={choice} onChange={setChoice} />}
            {need && <p className="text-xs font-semibold text-[var(--muted)]" data-testid={`agreement-role-${k}-video-hint`}>Pick one of the video options to confirm.</p>}
          </>)}
    </div>
  );
};

const Roles = ({ roles, onRead, busy }) => (roles.length ? roles.map((r, k) => <Role key={r.role} r={r} k={k} onRead={onRead} busy={busy} />)
  : <p className="text-sm text-[var(--muted)]" data-testid="agreement-no-roles">The skipper hasn't given you a role yet.</p>);

// preview: the crew member's name when the skipper is previewing an invite; everything stays on this screen, nothing is saved.
export const CrewAgreementDialog = ({ data: given, boat, vessel, areas, online, onSaved, onRead, onClose, preview = "" }) => {
  const [reading, setReading] = useState("");
  const [localReads, setLocalReads] = useState({});
  const data = preview ? { ...given, roles: (given.roles || []).map((r) => (localReads[r.role] ? { ...r, read_at: localReads[r.role] } : r)) } : given;
  const read = async (role, video = "") => {
    if (preview) { setLocalReads((m) => ({ ...m, [role]: new Date().toISOString() })); return; }
    if (!online) { toast.error("Go online to confirm you've read the briefing"); return; }
    setReading(role);
    try {
      const { data: res } = await api.post("/crew/briefing-read", { owner_id: boat.owner_id, boat_id: boat.boat_id, role, video });
      onRead(role, res.read_at, res.video_choice);
      toast.success(`Thanks! The skipper can see you've read the ${role} briefing`);
    } catch (e) { toast.error(apiError(e, "Couldn't save that, please try again")); }
    finally { setReading(""); }
  };
  const steps = walkSteps((boat.zone_maps || []).map((m) => ({ key: m.id, src: boatMapUrl(boat, m), map: m })), boat.walk_skip || [], areas, boat);
  const [ticked, setTicked] = useState(data.agreement?.stops || []);
  const [busy, setBusy] = useState("");
  const [walking, setWalking] = useState(null);
  const [quick, setQuick] = useState(false);
  const accepted = !!data.agreement?.accepted_at;
  const fullAt = !accepted && steps.length ? data.walkthrough?.full_at : null;
  const ready = steps.every((s) => ticked.includes(stopId(s)));
  const boatLines = (data.boat_terms || "").split("\n").map((l) => l.trim()).filter(Boolean).map((label) => ({ label }));
  const [before, setBefore] = useState([]);
  const pickQuick = (v) => { setQuick(v); if (v) { setBefore(ticked); setTicked(steps.map(stopId)); } else setTicked(before); };
  const tick = (id) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const seen = (id) => setTicked((t) => (t.includes(id) ? t : [...t, id]));
  const nextStop = Math.max(0, steps.findIndex((s) => !ticked.includes(stopId(s))));

  const unread = (data.roles || []).filter((r) => r.briefing && !r.read_at);
  const [briefWarn, setBriefWarn] = useState(false);
  const ag = data.agreement || {};
  const [termsOk, setTermsOk] = useState(!!ag.terms_ok_at || accepted);
  const [planOk, setPlanOk] = useState(!!ag.plan_ok_at || accepted);
  const [meetOk, setMeetOk] = useState(!!ag.meet_ok_at || accepted);
  const [showStops, setShowStops] = useState(false);
  const [warn, setWarn] = useState("");
  const trip = data.trip;
  const stop = (msg, testId) => { setWarn(msg); document.querySelector(`[data-testid="${testId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return false; };
  const shoreBrief = data.shore_brief || [];
  const [shoreOk, setShoreOk] = useState(!!data.agreement?.shore_ok_at);
  const [shoreWarn, setShoreWarn] = useState(false);
  const confirmShore = async () => {
    if (preview) { setShoreOk(true); return; }
    if (!online) { toast.error("Go online to confirm the shore contact instructions"); return; }
    try {
      const { data: res } = await api.post("/crew/shore-brief-ok", { owner_id: boat.owner_id, boat_id: boat.boat_id });
      setShoreOk(true);
      onSaved({ ...data.agreement, shore_ok_at: res.shore_ok_at });
      toast.success("Thanks! The skipper can see you understand the shore contact alerts");
    } catch (e) { toast.error(apiError(e, "Couldn't save that, please try again")); }
  };
  const briefingsDone = () => {
    setWarn("");
    if (data.terms.length && !termsOk) return stop("Please tick that you've read the Standard Terms before you accept.", "agreement-standard-terms");
    if (unread.length) {
      setBriefWarn(true);
      document.querySelector('[data-testid="agreement-roles"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (shoreBrief.length && !shoreOk) {
      setShoreWarn(true);
      document.querySelector('[data-testid="agreement-shore-alerts"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (trip && (!planOk || (trip.meetup_agree && !meetOk))) return stop("Please tick that you've read and accepted the skipper's plan before you accept.", "agreement-trip-plan");
    return true;
  };
  const save = async (accept) => {
    if (accept && !briefingsDone()) return;
    if (preview) { toast.message(accept ? `Preview: this is where ${preview} accepts. Nothing was saved.` : "Preview closed. Nothing was saved."); onClose(); return; }
    const same = !accept && shoreOk === !!data.agreement?.shore_ok_at && termsOk === !!ag.terms_ok_at && planOk === !!ag.plan_ok_at && meetOk === !!ag.meet_ok_at && ticked.length === (data.agreement?.stops || []).length && ticked.every((t) => data.agreement.stops.includes(t));
    if (accepted || (same && data.agreement)) { onClose(); return; }
    if (!online) { toast.error("Go online to save the agreement"); if (!accept) onClose(); return; }
    setBusy(accept ? "accept" : "later");
    try {
      const { data: res } = await api.post("/crew/agreement", { owner_id: boat.owner_id, boat_id: boat.boat_id, stops: ticked, accept, quick: accept && quick, shore_ok: shoreOk,
        terms_ok: termsOk, plan_ok: planOk, meet_ok: meetOk });
      onSaved(res.agreement);
      if (accept) toast.success(`Thanks! The skipper of ${vessel} can see you've read and accepted the agreement`);
      if (accept) window.dispatchEvent(new CustomEvent("mbp:agreement-accepted", { detail: { owner_id: boat.owner_id, boat_id: boat.boat_id } }));
      if (accept && data.joincrew_offer) offerToast();
      onClose();
    } catch (e) { toast.error(apiError(e, "Couldn't save the agreement, please try again")); }
    finally { setBusy(""); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && save(false)}>
      <DialogContent guard={false} className="flex max-h-[92vh] max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-agreement-dialog"
        onOpenAutoFocus={(e) => e.preventDefault()}>
        {preview && <p className="-mx-6 -mt-6 rounded-t-md bg-amber-100 py-2 pl-4 pr-12 text-sm font-bold text-amber-900" data-testid="crew-agreement-preview-banner">Preview: exactly what {preview} sees. Your own ticks are ignored and nothing is saved.</p>}
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Boat Terms and Conditions Agreement</DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="crew-agreement-intro">
            {accepted ? `You read and accepted this agreement for ${vessel} on ${new Date(data.agreement.accepted_at).toLocaleDateString()}.`
              : `Welcome aboard ${vessel}. Please read the terms and your role briefing, tick each stop of the Boat Walk Through, then accept.`}
          </DialogDescription>
        </DialogHeader>
        {data.terms.length > 0 && (
          <Section title="Standard terms" testId="agreement-standard-terms">
            {!termsOk && <Lines lines={data.terms} testId="agreement-standard-lines" />}
            <ReadTick checked={termsOk} disabled={accepted} onChange={(v) => { setTermsOk(v); setWarn(""); }} testId="agreement-terms-read">I&apos;ve read the Standard Terms</ReadTick>
          </Section>
        )}
        {boatLines.length > 0 && <Section title={`${vessel}'s terms`} testId="agreement-boat-terms"><Lines lines={boatLines} testId="agreement-boat-lines" /></Section>}
        <Section title="Your role briefing" testId="agreement-roles">
          <Roles roles={data.roles} onRead={read} busy={reading} />
          {briefWarn && unread.length > 0 && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="agreement-briefing-warning">
            Please read your role briefing{unread.length > 1 ? "s" : ""} and tick {unread.length > 1 ? "each one" : "it"} off ({unread.map((r) => r.role).join(", ")}) before you accept.</p>}
        </Section>
        {shoreBrief.length > 0 && (
          <Section title="Shore contact alerts" testId="agreement-shore-alerts">
            <Lines lines={shoreBrief.map((label) => ({ label }))} testId="agreement-shore-lines" />
            <label className={`flex items-start gap-3 rounded-md border-[1.5px] p-2.5 text-sm font-bold ${shoreOk ? "border-emerald-600 bg-emerald-50" : "border-[var(--navy)]"}`} data-testid="agreement-shore-understood">
              <input type="checkbox" checked={shoreOk} disabled={accepted && shoreOk} onChange={(e) => { if (accepted) { confirmShore(); return; } setShoreOk(e.target.checked); setShoreWarn(false); }} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700" data-testid="agreement-shore-understood-checkbox" />
              I understand how the shore contact is alerted and how to stand them down
            </label>
            {shoreWarn && !shoreOk && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="agreement-shore-warning">Please tick that you understand the shore contact alert instructions before you accept.</p>}
          </Section>
        )}
        <Section title={`Boat Walk Through${steps.length ? ` (${steps.filter((s) => ticked.includes(stopId(s))).length} of ${steps.length} ticked)` : ""}`} testId="agreement-walkthrough-section">
          {fullAt && (
            <label className={`flex items-start gap-3 rounded-md border-[1.5px] p-2.5 text-sm font-semibold ${quick ? "border-emerald-600 bg-emerald-50" : "border-[var(--line)]"}`} data-testid="agreement-quick">
              <input type="checkbox" checked={quick} onChange={(e) => pickQuick(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700" data-testid="agreement-quick-checkbox" />
              <span>I will check with the skipper if anything has moved since I did the complete walkthrough <span className="block text-xs font-normal text-[var(--muted)]">You did it {timeAgo(fullAt)} ({localWhen(fullAt)}).</span></span>
            </label>
          )}
          {ready && steps.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Done testId="agreement-walkthrough-done">Boat walkthrough completed</Done>
              <button type="button" className="text-xs font-bold text-[var(--navy)] underline" onClick={() => setShowStops((v) => !v)} data-testid="agreement-walkthrough-show-btn">{showStops ? "Hide stops" : "Show stops"}</button>
            </div>
          )}
          {steps.length > 0 && !accepted && !quick && !ready && (
            <button type="button" className="btn-solid h-11 justify-center gap-2" onClick={() => setWalking(nextStop)} data-testid="agreement-start-walkthrough-btn">
              <Footprints className="h-4 w-4" /> {ready ? "Walk through again" : ticked.length ? "Carry on the walkthrough" : "Start the walkthrough"}
            </button>
          )}
          {(!ready || showStops || !steps.length) && <AgreementWalkthrough steps={steps} areas={areas} boat={boat} ticked={ticked} onChange={accepted ? () => {} : setTicked} onOpenStop={accepted || quick ? undefined : setWalking} />}
        </Section>
        {trip && <TripPlanSection trip={trip} ok={planOk} meetOk={meetOk} locked={accepted} onOk={(v) => { setPlanOk(v); setWarn(""); }} onMeetOk={setMeetOk} />}
        {warn && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="agreement-tick-warning">{warn}</p>}
        {data.joincrew_offer && <JoinCrewOffer />}
        <AcceptButtons accepted={accepted} ready={ready} busy={busy} onTry={briefingsDone} onAccept={() => save(true)} onLater={() => save(false)} />
        {walking !== null && <CrewWalkthrough steps={steps} areas={areas} boat={boat} start={walking} ticked={ticked} onTick={tick} onSeen={seen} onClose={() => setWalking(null)} onOpenArea={() => {}} />}
      </DialogContent>
    </Dialog>
  );
};
