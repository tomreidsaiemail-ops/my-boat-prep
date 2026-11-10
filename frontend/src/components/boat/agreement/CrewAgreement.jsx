import { useCallback, useEffect, useState } from "react";
import { setPendingAgreement } from "@/lib/pendingAgreement";
import { ChevronRight, FileCheck2, FileDown, FileWarning, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { holdPrompt, usePromptsFree } from "@/lib/promptQueue";
import { downloadAgreement } from "@/lib/agreementPdf";
import { CrewAgreementDialog } from "@/components/boat/agreement/CrewAgreementDialog";

const shown = new Set();
// Joining (or re-joining) a boat always brings the Terms and Conditions up again.
export const forgetShownAgreements = () => shown.clear();

// Crew view: opens the agreement once after joining, then a bar shows whether it's been accepted.
export const CrewAgreement = ({ boat, vessel, areas, online }) => {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const seenKey = `${boat.owner_id}_${boat.boat_id}`;
  const load = useCallback(() => api.get("/crew/agreement", { params: { owner_id: boat.owner_id, boat_id: boat.boat_id }, timeout: 10000 }).then(({ data: d }) => {
    setData(d);
    if (d.agreement?.accepted_at) shown.delete(seenKey);
    else if (!shown.has(seenKey)) { shown.add(seenKey); setOpen(true); }
  }).catch(() => {}), [boat.owner_id, boat.boat_id, seenKey]);
  useEffect(() => { setData(null); setOpen(false); if (online) load(); }, [online, load]);
  const free = usePromptsFree(["invite"]);
  useEffect(() => { holdPrompt("agreement", open); return () => holdPrompt("agreement", false); }, [open]);
  const waiting = !!data && !data.agreement?.accepted_at;
  useEffect(() => { setPendingAgreement(waiting ? vessel : ""); return () => setPendingAgreement(""); }, [waiting, vessel]);
  if (!data) return null;
  const accepted = !!data.agreement?.accepted_at;
  const unread = (data.roles || []).filter((r) => r.briefing && !r.read_at).length;
  const Icon = accepted ? FileCheck2 : FileWarning;
  return (
    <>
      <div className="flex items-stretch gap-2">
        <button type="button" onClick={() => setOpen(true)} data-testid="crew-agreement-bar"
          className={`flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-lg border-[1.5px] px-3 text-left text-sm font-bold [transition:border-color_.15s] ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-800 bg-[var(--red)] text-white"}`}>
          <Icon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1" data-testid="crew-agreement-status">{accepted ? "Boat Terms and Conditions accepted. View agreement" : "Boat Terms and Conditions not accepted yet. Read and accept"}
            {unread > 0 && <span className={`block text-xs ${accepted ? "text-amber-800" : "text-red-50"}`} data-testid="crew-agreement-unread">{unread} role {unread === 1 ? "briefing" : "briefings"} to read and confirm</span>}</span>
          <ChevronRight className="h-5 w-5 shrink-0" />
        </button>
        <button type="button" className="btn-ghost w-14 shrink-0 flex-col justify-center gap-0.5 px-1 text-[11px]" disabled={pdfBusy || !online} aria-label="Download my agreement as a PDF"
          onClick={async () => { setPdfBusy(true); await downloadAgreement({ ownerId: boat.owner_id, boatId: boat.boat_id, name: vessel }); setPdfBusy(false); }} data-testid="crew-agreement-pdf-btn">
          {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
        </button>
      </div>
      {open && free && <CrewAgreementDialog data={data} boat={boat} vessel={vessel} areas={areas} online={online}
        onSaved={(a) => setData((d) => ({ ...d, agreement: a }))} onRead={(role, at) => setData((d) => ({ ...d, roles: d.roles.map((r) => (r.role === role ? { ...r, read_at: at } : r)) }))} onClose={() => setOpen(false)} />}
    </>
  );
};
