import { useState } from "react";
import { toast } from "sonner";
import { Check, Footprints, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { CrewWalkthrough, walkSteps } from "@/components/boat/CrewWalkthrough";
import { localWhen, timeAgo } from "@/lib/timeAgo";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { AcceptButtons, AgreementWalkthrough, stopId } from "@/components/boat/agreement/AgreementParts";
import { JoinCrewOffer, offerToast } from "@/components/boat/agreement/JoinCrewOffer";

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

const Roles = ({ roles, onRead, busy }) => (roles.length ? roles.map((r, k) => (
  <div key={r.role} className="flex flex-col gap-1.5 rounded-md bg-sky-50 p-2.5 text-sm" data-testid={`agreement-role-${k}`}>
    <b>{r.role}</b>
    <p className="whitespace-pre-wrap" data-testid={`agreement-role-${k}-briefing`}>{r.briefing || "No briefing from the skipper for this role yet."}</p>
    {r.briefing && (r.read_at
      ? <span className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900" data-testid={`agreement-role-${k}-read`}><Check className="h-3.5 w-3.5" strokeWidth={3} /> Read {new Date(r.read_at).toLocaleDateString()}</span>
      : <label className="flex items-center gap-2 self-start rounded-md border-[1.5px] border-[var(--navy)] bg-white px-2.5 py-1.5 text-sm font-bold" data-testid={`agreement-role-${k}-read-btn`}>
          {busy === r.role ? <Loader2 className="h-5 w-5 animate-spin" /> : <input type="checkbox" checked={false} onChange={() => onRead(r.role)} className="h-5 w-5 accent-emerald-700" data-testid={`agreement-role-${k}-read-checkbox`} />}
          I&apos;ve read the {r.role} briefing
        </label>)}
  </div>
)) : <p className="text-sm text-[var(--muted)]" data-testid="agreement-no-roles">The skipper hasn't given you a role yet.</p>);

export const CrewAgreementDialog = ({ data, boat, vessel, areas, online, onSaved, onRead, onClose }) => {
  const [reading, setReading] = useState("");
  const read = async (role) => {
    if (!online) { toast.error("Go online to confirm you've read the briefing"); return; }
    setReading(role);
    try {
      const { data: res } = await api.post("/crew/briefing-read", { owner_id: boat.owner_id, boat_id: boat.boat_id, role });
      onRead(role, res.read_at);
      toast.success(`Thanks! The skipper can see you've read the ${role} briefing`);
    } catch (e) { toast.error(apiError(e, "Couldn't save that, please try again")); }
    finally { setReading(""); }
  };
  const steps = walkSteps((boat.zone_maps || []).map((m) => ({ key: m.id, src: boatMapUrl(boat, m), map: m })), boat.walk_skip || []);
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
  const shoreBrief = data.shore_brief || [];
  const [shoreOk, setShoreOk] = useState(!!data.agreement?.shore_ok_at);
  const [shoreWarn, setShoreWarn] = useState(false);
  const confirmShore = async () => {
    if (!online) { toast.error("Go online to confirm the shore contact instructions"); return; }
    try {
      const { data: res } = await api.post("/crew/shore-brief-ok", { owner_id: boat.owner_id, boat_id: boat.boat_id });
      setShoreOk(true);
      onSaved({ ...data.agreement, shore_ok_at: res.shore_ok_at });
      toast.success("Thanks! The skipper can see you understand the shore contact alerts");
    } catch (e) { toast.error(apiError(e, "Couldn't save that, please try again")); }
  };
  const briefingsDone = () => {
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
    return true;
  };
  const save = async (accept) => {
    if (accept && !briefingsDone()) return;
    const same = !accept && shoreOk === !!data.agreement?.shore_ok_at && ticked.length === (data.agreement?.stops || []).length && ticked.every((t) => data.agreement.stops.includes(t));
    if (accepted || (same && data.agreement)) { onClose(); return; }
    if (!online) { toast.error("Go online to save the agreement"); if (!accept) onClose(); return; }
    setBusy(accept ? "accept" : "later");
    try {
      const { data: res } = await api.post("/crew/agreement", { owner_id: boat.owner_id, boat_id: boat.boat_id, stops: ticked, accept, quick: accept && quick, shore_ok: shoreOk });
      onSaved(res.agreement);
      if (accept) toast.success(`Thanks! The skipper of ${vessel} can see you've read and accepted the agreement`);
      if (accept && data.joincrew_offer) offerToast();
      onClose();
    } catch (e) { toast.error(apiError(e, "Couldn't save the agreement, please try again")); }
    finally { setBusy(""); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && save(false)}>
      <DialogContent guard={false} className="flex max-h-[92vh] max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-agreement-dialog"
        onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Boat Terms and Conditions Agreement</DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="crew-agreement-intro">
            {accepted ? `You read and accepted this agreement for ${vessel} on ${new Date(data.agreement.accepted_at).toLocaleDateString()}.`
              : `Welcome aboard ${vessel}. Please read the terms and your role briefing, tick each stop of the Boat Walk Through, then accept.`}
          </DialogDescription>
        </DialogHeader>
        {data.terms.length > 0 && <Section title="Standard terms" testId="agreement-standard-terms"><Lines lines={data.terms} testId="agreement-standard-lines" /></Section>}
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
          {steps.length > 0 && !accepted && !quick && (
            <button type="button" className="btn-solid h-11 justify-center gap-2" onClick={() => setWalking(nextStop)} data-testid="agreement-start-walkthrough-btn">
              <Footprints className="h-4 w-4" /> {ready ? "Walk through again" : ticked.length ? "Carry on the walkthrough" : "Start the walkthrough"}
            </button>
          )}
          <AgreementWalkthrough steps={steps} areas={areas} boat={boat} ticked={ticked} onChange={accepted ? () => {} : setTicked} onOpenStop={accepted || quick ? undefined : setWalking} />
        </Section>
        {data.joincrew_offer && <JoinCrewOffer />}
        <AcceptButtons accepted={accepted} ready={ready} busy={busy} onTry={briefingsDone} onAccept={() => save(true)} onLater={() => save(false)} />
        {walking !== null && <CrewWalkthrough steps={steps} areas={areas} boat={boat} start={walking} ticked={ticked} onTick={tick} onSeen={seen} onClose={() => setWalking(null)} onOpenArea={() => {}} />}
      </DialogContent>
    </Dialog>
  );
};
