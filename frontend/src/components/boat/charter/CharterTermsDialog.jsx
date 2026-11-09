import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Anchor, Check, Footprints, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { fmtDay, fmtPeriod, isOverdue } from "@/lib/charter";
import { EndCharter } from "@/components/boat/charter/EndCharter";
import { localWhen } from "@/lib/timeAgo";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { CrewWalkthrough, walkSteps } from "@/components/boat/CrewWalkthrough";
import { AgreementWalkthrough, stopId } from "@/components/boat/agreement/AgreementParts";

const seenKey = (boatId) => `mbp_charter_terms_seen_${boatId}`;

// The charter skipper signs the Charter Boat Terms and Conditions, ticking off the owner's charter skipper responsibilities
// and every stop of the Zone Map Walk Through (none are skipped for a charter skipper).
export const CharterTermsDialog = ({ boat, areas = [], online, forceOpen, onClosed }) => {
  const [terms, setTerms] = useState(null);
  const [walking, setWalking] = useState(false);
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!boat?.charter || !online) return;
    api.get("/charter-terms", { params: { boat_id: boat.boat_id } }).then(({ data }) => {
      setTerms(data); setTicked(data.ticked || []);
      if (!data.accepted_at && sessionStorage.getItem(seenKey(boat.boat_id)) !== "1") setOpen(true);
    }).catch(() => {});
  }, [boat?.boat_id, online]); // eslint-disable-line react-hooks/exhaustive-deps
  const handled = useRef(0);
  useEffect(() => { if (forceOpen && terms && handled.current !== forceOpen) { handled.current = forceOpen; setOpen(true); } }, [forceOpen, terms]);
  if (!terms) return null;
  const close = () => { sessionStorage.setItem(seenKey(boat.boat_id), "1"); setOpen(false); onClosed?.(); };
  const tick = (id) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  // The server's stop list decides what must be ticked; the zone maps supply the photos.
  const want = new Set((terms.stops || []).map((s) => s.id));
  const steps = walkSteps((boat.zone_maps || []).map((m) => ({ key: m.id, src: boatMapUrl(boat, m), map: m }))).filter((s) => want.has(stopId(s)));
  const seen = (terms.stops || []).filter((s) => ticked.includes(s.id)).length;
  const ready = terms.responsibilities.every((r) => ticked.includes(r.id)) && seen === (terms.stops || []).length;
  const accept = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/charter-terms", { ticked }, { params: { boat_id: boat.boat_id } });
      setTerms((t) => ({ ...t, accepted_at: data.accepted_at })); toast.success("Charter Boat Terms and Conditions accepted. Enjoy your charter!"); close();
      window.dispatchEvent(new Event("mbp:refresh-boat"));
    } catch (e) { toast.error(apiError(e, "Couldn't save, please try again")); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent guard={false} className="flex max-h-[92vh] max-w-md flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="charter-terms-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase">Charter Boat Terms and Conditions</DialogTitle>
          <DialogDescription>{terms.vessel} from {terms.owner_name}, {fmtPeriod(terms)}.</DialogDescription>
        </DialogHeader>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm" data-testid="charter-terms-list">{terms.terms.map((t, i) => <li key={i}>{t}</li>)}</ol>
        {terms.responsibilities.length > 0 && (
          <div className="flex flex-col gap-1.5" data-testid="charter-resp">
            <p className="field-label">Charter skipper responsibilities ({ticked.filter((x) => terms.responsibilities.some((r) => r.id === x)).length} of {terms.responsibilities.length} ticked)</p>
            {terms.responsibilities.map((r) => (
              <label key={r.id} className="flex min-h-10 cursor-pointer items-start gap-3 text-sm" data-testid={`charter-resp-${r.id}`}>
                <input type="checkbox" checked={ticked.includes(r.id)} disabled={!!terms.accepted_at} onChange={() => tick(r.id)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700" data-testid={`charter-resp-checkbox-${r.id}`} /> {r.label}
              </label>
            ))}
          </div>
        )}
        {steps.length > 0 && (
          <div className="flex flex-col gap-1.5" data-testid="charter-walk-section">
            <p className="field-label" data-testid="charter-walk-count">Zone Map Walk Through ({seen} of {steps.length} ticked)</p>
            <p className="text-xs text-[var(--muted)]">Find every labelled spot on board, including the bilge pumps and bungs, and tick each one once you&apos;ve seen it.</p>
            {!terms.accepted_at && (
              <button type="button" className="btn-solid h-11 justify-center gap-2" onClick={() => setWalking(true)} data-testid="charter-walk-start-btn">
                <Footprints className="h-4 w-4" /> {seen ? "Carry on the walkthrough" : "Start the walkthrough"}
              </button>
            )}
            <AgreementWalkthrough steps={steps} areas={areas} ticked={ticked} onChange={terms.accepted_at ? () => {} : setTicked} />
          </div>
        )}
        {terms.accepted_at ? <p className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-900" data-testid="charter-terms-accepted"><Check className="h-4 w-4" /> Accepted {localWhen(terms.accepted_at)}</p> : (
          <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!ready || busy || !online} onClick={accept} data-testid="charter-terms-accept-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Anchor className="h-4 w-4" />} I accept the Charter Boat Terms and Conditions
          </button>
        )}
        <button type="button" className="btn-ghost h-11 justify-center" onClick={close} data-testid="charter-terms-later-btn">{terms.accepted_at ? "Close" : "Later"}</button>
        {walking && <CrewWalkthrough steps={steps} areas={areas} ticked={ticked} onTick={tick} onClose={() => setWalking(false)} onOpenArea={() => {}} />}
      </DialogContent>
    </Dialog>
  );
};

export const CharterBanner = ({ entry, online, onTerms, onEnded }) => {
  const lock = entry.charter_lock;
  if (lock) return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950" data-testid="charter-lock-banner">
      <p><b>On charter</b> to {lock.name}, {fmtPeriod(lock)}. This boat and its crew are read only until you end the charter.</p>
      {!entry.crew && isOverdue(lock) && <p className="font-extrabold" data-testid="charter-overdue-reminder">Reminder: the charter ended {fmtDay(lock.end)}. End it to unlock your boat and bring back {lock.name}&apos;s Ship&apos;s Log and To Do List.</p>}
      {!entry.crew && <div className="flex"><EndCharter c={lock} vessel={entry.vessel || "Your boat"} online={online} onEnded={onEnded} className="btn-solid h-10 justify-center gap-2 px-4" /></div>}
    </div>
  );
  if (entry.charter?.returned_at) return (
    <p className="rounded-lg border-2 border-slate-400 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900" data-testid="charter-ended-banner">
      <b>Charter ended</b> {localWhen(entry.charter.returned_at)}. Thank you for skippering {entry.charter.vessel}! This copy is read only{entry.charter.delete_at ? ` and is deleted ${localWhen(entry.charter.delete_at)}` : ""}.
    </p>
  );
  if (entry.charter) return (
    <p className="flex flex-wrap items-center gap-x-2 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950" data-testid="charter-skipper-banner">
      <span><b>Charter skipper</b> of {entry.charter.vessel} from {entry.charter.owner_name}, {fmtPeriod(entry.charter)}.</span>
      <button type="button" className="font-extrabold underline" onClick={onTerms} data-testid="charter-terms-open-btn">Charter Terms...</button>
    </p>
  );
  return null;
};
