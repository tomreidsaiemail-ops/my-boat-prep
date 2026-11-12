import { PHONE_HINT, phoneFieldErrors } from "@/lib/phone";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { CREW_FIELDS, PARTY_FIELDS, missing, toForm, toPayload } from "@/lib/crewRegister";
import { RegFields } from "@/components/boat/register/RegFields";

// Skipper adds or edits a crew member or an interested party. entry: { kind, ...existing } or null.
export const RegEntryDialog = ({ entry, onSaved, onClose }) => {
  const party = entry?.kind === "party";
  const fields = party ? PARTY_FIELDS : CREW_FIELDS;
  const need = party ? ["name", "phone", "email"] : ["name", "email"];
  const [values, setValues] = useState(toForm());
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (entry) { setValues(toForm(entry)); setErrors([]); } }, [entry]);

  const quickable = !party && !entry?.entry_id;
  const save = async (quick = false) => {
    const miss = missing(values, fields.filter((f) => need.includes(f.k)));
    if (miss.length) { setErrors(miss); toast.error(party ? "Enter their name, phone number and email" : "Enter at least their name and email"); return; }
    const badPhone = phoneFieldErrors(values);
    if (badPhone.length) { setErrors(badPhone); toast.error(PHONE_HINT); return; }
    setBusy(true);
    try {
      const body = toPayload(values, fields);
      if (entry.entry_id) await api.put(`/crew-register/${entry.entry_id}`, body);
      else await api.post("/crew-register", { ...body, kind: entry.kind, ...(quick ? { quick: true } : {}) });
      toast.success(quick ? `${body.name} is registered with Quick Reg` : `${body.name} saved`);
      onSaved();
      onClose();
    } catch (err) { toast.error(apiError(err, "Couldn't save, please try again")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="reg-entry-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{entry?.entry_id ? "Edit" : "Add"} {party ? "interested party" : "crew member"}</DialogTitle>
          <DialogDescription className="text-left text-sm">
            {party ? "Interested parties are registered straight away and can be emailed the crew's details." : "Fill in what you know. They confirm or correct everything when they complete their registration."}
            {quickable && <span className="mt-1 flex items-start gap-1 font-semibold text-[var(--navy)]" data-testid="reg-entry-quick-help"><Zap className="mt-0.5 h-4 w-4 shrink-0 fill-amber-300 text-amber-600" /> Quick Reg registers them straight away with just a name and email. You can ask them to add their own details later.</span>}
          </DialogDescription>
        </DialogHeader>
        <RegFields fields={fields} values={values} required={need} errors={errors} testPrefix="reg-entry"
          onChange={(k, v) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => e.filter((x) => x !== k)); }} />
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onClose} data-testid="reg-entry-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-1 justify-center gap-2" disabled={busy} onClick={() => save()} data-testid="reg-entry-save-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
        {quickable && (
          <button type="button" className="btn-ghost h-12 justify-center gap-2 border-amber-500 bg-amber-50" disabled={busy} onClick={() => save(true)} data-testid="reg-entry-quick-btn">
            <Zap className="h-4 w-4 fill-amber-300 text-amber-600" /> Quick Reg: register them now
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};
