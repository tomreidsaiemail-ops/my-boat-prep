import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { walkSteps } from "@/components/boat/CrewWalkthrough";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { AcceptButtons, AgreementWalkthrough, stopId } from "@/components/boat/agreement/AgreementParts";

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

const Roles = ({ roles }) => (roles.length ? roles.map((r, k) => (
  <div key={r.role} className="rounded-md bg-sky-50 p-2.5 text-sm" data-testid={`agreement-role-${k}`}>
    <b>{r.role}</b>
    <p className="whitespace-pre-wrap" data-testid={`agreement-role-${k}-briefing`}>{r.briefing || "No briefing from the skipper for this role yet."}</p>
  </div>
)) : <p className="text-sm text-[var(--muted)]" data-testid="agreement-no-roles">The skipper hasn't given you a role yet.</p>);

export const CrewAgreementDialog = ({ data, boat, vessel, areas, online, onSaved, onClose }) => {
  const steps = walkSteps((boat.zone_maps || []).map((m) => ({ key: m.id, src: boatMapUrl(boat, m), map: m })));
  const [ticked, setTicked] = useState(data.agreement?.stops || []);
  const [busy, setBusy] = useState("");
  const accepted = !!data.agreement?.accepted_at;
  const ready = steps.every((s) => ticked.includes(stopId(s)));
  const boatLines = (data.boat_terms || "").split("\n").map((l) => l.trim()).filter(Boolean).map((label) => ({ label }));

  const save = async (accept) => {
    const same = !accept && ticked.length === (data.agreement?.stops || []).length && ticked.every((t) => data.agreement.stops.includes(t));
    if (accepted || (same && data.agreement)) { onClose(); return; }
    if (!online) { toast.error("Go online to save the agreement"); if (!accept) onClose(); return; }
    setBusy(accept ? "accept" : "later");
    try {
      const { data: res } = await api.post("/crew/agreement", { owner_id: boat.owner_id, boat_id: boat.boat_id, stops: ticked, accept });
      onSaved(res.agreement);
      if (accept) toast.success(`Thanks! The skipper of ${vessel} can see you've read and accepted the agreement`);
      onClose();
    } catch (e) { toast.error(apiError(e, "Couldn't save the agreement, please try again")); }
    finally { setBusy(""); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && save(false)}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-agreement-dialog"
        onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Boat Terms and Conditions Agreement</DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="crew-agreement-intro">
            {accepted ? `You read and accepted this agreement for ${vessel} on ${new Date(data.agreement.accepted_at).toLocaleDateString()}.`
              : `Welcome aboard ${vessel}. Please read the terms and your role briefing, tick each stop of the Zone Map Walk Through, then accept.`}
          </DialogDescription>
        </DialogHeader>
        {data.terms.length > 0 && <Section title="Standard terms" testId="agreement-standard-terms"><Lines lines={data.terms} testId="agreement-standard-lines" /></Section>}
        {boatLines.length > 0 && <Section title={`${vessel}'s terms`} testId="agreement-boat-terms"><Lines lines={boatLines} testId="agreement-boat-lines" /></Section>}
        <Section title="Your role briefing" testId="agreement-roles"><Roles roles={data.roles} /></Section>
        <Section title={`Zone Map Walk Through${steps.length ? ` (${steps.filter((s) => ticked.includes(stopId(s))).length} of ${steps.length} ticked)` : ""}`} testId="agreement-walkthrough-section">
          <AgreementWalkthrough steps={steps} areas={areas} ticked={ticked} onChange={accepted ? () => {} : setTicked} />
        </Section>
        <AcceptButtons accepted={accepted} ready={ready} busy={busy} onAccept={() => save(true)} onLater={() => save(false)} />
      </DialogContent>
    </Dialog>
  );
};
