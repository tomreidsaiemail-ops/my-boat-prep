import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { EmailPartiesDialog } from "@/components/boat/register/EmailPartiesDialog";

// Opens the pick-crew, pick-party window for emailing crew details to an interested party.
export const EmailPartiesButton = ({ boatId, online, premium, onUpgrade, testId = "email-parties-btn" }) => {
  const [busy, setBusy] = useState(false);
  const [reg, setReg] = useState(null);

  const start = async () => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { toast.error("Go online to email crew details"); return; }
    setBusy(true);
    try {
      const { data } = await api.get("/crew-register");
      if (!data.parties.length) toast.error("Add an interested party in Crew Registration first");
      else if (!data.crew.length) toast.error("Add crew in Crew Registration first");
      else setReg(data);
    } catch (err) { toast.error(apiError(err)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" className="btn-ghost h-11 w-full justify-center gap-2" disabled={busy} onClick={start} data-testid={testId}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Email crew details to interested parties
      </button>
      <EmailPartiesDialog open={!!reg} boatId={boatId} reg={reg || { crew: [], parties: [] }} onClose={() => setReg(null)} />
    </>
  );
};
