import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { CREW_FIELDS, missing, toForm, toPayload } from "@/lib/crewRegister";
import { RegFields } from "@/components/boat/register/RegFields";
import { holdPrompt, usePromptsFree } from "@/lib/promptQueue";

const LATER_KEY = "mbp_register_later";
const later = () => { try { return JSON.parse(sessionStorage.getItem(LATER_KEY)) || []; } catch { return []; } };
const ALL = CREW_FIELDS.map((f) => f.k);

const TextSkipper = ({ skipper }) => (
  <p className="rounded-md border-2 border-[var(--navy)] bg-sky-50 p-3 text-center text-base font-extrabold" data-testid="crew-reg-text-skipper">
    Please text {skipper} to let them know you have completed your Crew Registration.
  </p>
);

// Crew side: shown after sign-in when a skipper has asked them to register (or invited them aboard before they registered).
export const CrewRegistrationPrompt = () => {
  const free = usePromptsFree(["invite", "agreement"]);
  const [list, setList] = useState(null);
  const [values, setValues] = useState(toForm());
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => {
    if (!navigator.onLine) { setList([]); return; }
    api.get("/crew-register/mine", { timeout: 10000 }).then(({ data }) => setList(data.requests.filter((r) => !later().includes(r.entry_id)))).catch(() => setList([]));
  }, []);
  const req = list?.[0];
  useEffect(() => { if (req) { setValues(toForm(req)); setErrors([]); } }, [req]);
  const showing = list === null || !!(req || done);
  useEffect(() => { holdPrompt("register", showing); return () => holdPrompt("register", false); }, [showing]);
  if ((!req && !done) || !free) return null;

  const next = () => { setDone(null); setList((l) => l.slice(1)); };
  const notNow = () => { sessionStorage.setItem(LATER_KEY, JSON.stringify([...later(), req.entry_id])); next(); };
  const submit = async () => {
    const miss = missing(values);
    if (miss.length) { setErrors(miss); toast.error("Every field is needed. Type None if something doesn't apply."); return; }
    setBusy(true);
    try {
      await api.put(`/crew-register/mine/${req.entry_id}`, toPayload(values));
      setDone(req.skipper);
    } catch (err) { toast.error(apiError(err, "Couldn't save your registration, please try again")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && (done ? next() : notNow())}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-reg-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{done ? "You're registered" : "Crew Registration"}</DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="crew-reg-intro">
            {done ? `${done} can now see your registration.` : `${req.skipper} would like you to register as crew. You only do this once. Check or correct each field. Every field is needed, so type None if something doesn't apply.`}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-2" data-testid="crew-reg-done">
            <CheckCircle2 className="h-16 w-16 text-[var(--green)]" />
            <span className="tick-badge" data-testid="crew-reg-done-badge">Registered</span>
            <TextSkipper skipper={done} />
            <button type="button" className="btn-solid h-12 w-full justify-center" onClick={next} data-testid="crew-reg-done-btn">Done</button>
          </div>
        ) : (
          <>
            <RegFields fields={CREW_FIELDS} values={values} required={ALL} errors={errors} testPrefix="crew-reg"
              onChange={(k, v) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => e.filter((x) => x !== k)); }} />
            <div className="flex gap-2">
              <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={notNow} data-testid="crew-reg-later-btn">Not now</button>
              <button type="button" className="btn-solid h-12 flex-[2] justify-center gap-2" disabled={busy} onClick={submit} data-testid="crew-reg-submit-btn">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Complete registration
              </button>
            </div>
            <TextSkipper skipper={req.skipper} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
