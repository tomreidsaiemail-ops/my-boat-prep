import { useState } from "react";
import { FileDown, Loader2, Mail } from "lucide-react";
import { downloadAgreement } from "@/lib/agreementPdf";

// Skipper's tools under a crew member: download their agreement, or email their role briefing again.
export const CrewMemberTools = ({ boat, member, online, sending, onBriefing, testId }) => {
  const [busy, setBusy] = useState(false);
  const name = member.name || member.email;
  const pdf = async () => {
    setBusy(true);
    await downloadAgreement({ boatId: boat.boat_id, memberId: member.user_id, name });
    setBusy(false);
  };
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <button type="button" className="btn-ghost h-8 gap-1 px-2 text-xs" onClick={pdf} disabled={busy || !online} data-testid={`${testId}-agreement-pdf-btn`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Agreement PDF
      </button>
      <button type="button" className="btn-ghost h-8 gap-1 px-2 text-xs" onClick={() => onBriefing(member)} disabled={!!sending || !online} data-testid={`${testId}-briefing-btn`}>
        {sending === member.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Resend briefing
      </button>
    </div>
  );
};
