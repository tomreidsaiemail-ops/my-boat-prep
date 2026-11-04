import { useCallback, useEffect, useState } from "react";
import { ChevronRight, FileCheck2, FileDown, FileWarning, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { downloadAgreement } from "@/lib/agreementPdf";
import { CrewAgreementDialog } from "@/components/boat/agreement/CrewAgreementDialog";

// Crew view: opens the agreement once after joining, then a bar shows whether it's been accepted.
export const CrewAgreement = ({ boat, vessel, areas, online }) => {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const seenKey = `mbp_agreement_seen_${boat.owner_id}_${boat.boat_id}`;
  const load = useCallback(() => api.get("/crew/agreement", { params: { owner_id: boat.owner_id, boat_id: boat.boat_id }, timeout: 10000 }).then(({ data: d }) => {
    setData(d);
    if (!d.agreement?.accepted_at && !sessionStorage.getItem(seenKey)) { sessionStorage.setItem(seenKey, "1"); setOpen(true); }
  }).catch(() => {}), [boat.owner_id, boat.boat_id, seenKey]);
  useEffect(() => { setData(null); setOpen(false); if (online) load(); }, [online, load]);
  if (!data) return null;
  const accepted = !!data.agreement?.accepted_at;
  const Icon = accepted ? FileCheck2 : FileWarning;
  return (
    <>
      <div className="flex items-stretch gap-2">
        <button type="button" onClick={() => setOpen(true)} data-testid="crew-agreement-bar"
          className={`flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-lg border-[1.5px] px-3 text-left text-sm font-bold [transition:border-color_.15s] ${accepted ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
          <Icon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1" data-testid="crew-agreement-status">{accepted ? "Boat Terms and Conditions accepted. View agreement" : "Boat Terms and Conditions not accepted yet. Read and accept"}</span>
          <ChevronRight className="h-5 w-5 shrink-0" />
        </button>
        <button type="button" className="btn-ghost w-14 shrink-0 flex-col justify-center gap-0.5 px-1 text-[11px]" disabled={pdfBusy || !online} aria-label="Download my agreement as a PDF"
          onClick={async () => { setPdfBusy(true); await downloadAgreement({ ownerId: boat.owner_id, boatId: boat.boat_id, name: vessel }); setPdfBusy(false); }} data-testid="crew-agreement-pdf-btn">
          {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
        </button>
      </div>
      {open && <CrewAgreementDialog data={data} boat={boat} vessel={vessel} areas={areas} online={online}
        onSaved={(a) => setData((d) => ({ ...d, agreement: a }))} onClose={() => setOpen(false)} />}
    </>
  );
};
