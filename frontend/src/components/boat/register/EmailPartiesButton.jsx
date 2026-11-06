import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

// Emails every interested party the crew's name, phone, email, age, height and next of kin. Warns first if anyone hasn't registered.
export const EmailPartiesButton = ({ online, premium, onUpgrade, testId = "email-parties-btn" }) => {
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState(null);

  const send = async () => {
    setWarn(null); setBusy(true);
    try {
      const { data } = await api.post("/crew-register/parties-email", {}, { timeout: 30000 });
      toast.success(`Crew details for ${data.crew} crew emailed to ${data.sent_to.join(", ")}`);
    } catch (err) { toast.error(apiError(err, "Couldn't email the crew details, please try again")); }
    finally { setBusy(false); }
  };
  const start = async () => {
    if (!premium) { onUpgrade(); return; }
    if (!online) { toast.error("Go online to email crew details"); return; }
    setBusy(true);
    try {
      const { data } = await api.get("/crew-register");
      if (!data.parties.length) { toast.error("Add an interested party in Crew Registration first"); return; }
      if (!data.crew.length) { toast.error("Add crew in Crew Registration first"); return; }
      const not = data.crew.filter((c) => c.status !== "registered").map((c) => c.name);
      if (not.length) setWarn(not); else await send();
    } catch (err) { toast.error(apiError(err)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" className="btn-ghost h-11 w-full justify-center gap-2" disabled={busy} onClick={start} data-testid={testId}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Email crew details to interested parties
      </button>
      <ConfirmDelete item={warn} title="Some crew aren't registered yet" testId="email-parties-warn" danger={false} confirmLabel="Send anyway" cancelLabel="Cancel"
        note={`${(warn || []).join(", ")} ${warn?.length === 1 ? "hasn't" : "haven't"} completed registration, so their details may be missing or out of date. Send anyway?`}
        onConfirm={send} onClose={() => setWarn(null)} />
    </>
  );
};
