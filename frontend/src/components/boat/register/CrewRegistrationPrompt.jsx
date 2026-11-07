import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { CREW_FIELDS, missing, toForm, toPayload } from "@/lib/crewRegister";
import { RegFields } from "@/components/boat/register/RegFields";
import { holdPrompt, usePromptsFree } from "@/lib/promptQueue";
import { WaitingForInvite, stopWaiting, waitingOff } from "@/components/boat/register/WaitingForInvite";

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
  const [hasBoat, setHasBoat] = useState(true);
  const [waiting, setWaiting] = useState(null);
  useEffect(() => {
    if (!navigator.onLine) { setList([]); return; }
    api.get("/crew-register/mine", { timeout: 10000 }).then(({ data }) => {
      setHasBoat(data.has_boat !== false);
      setList(data.requests.filter((r) => !later().includes(r.entry_id)));
      if (data.waiting && !waitingOff()) setWaiting(data.waiting);
    }).catch(() => setList([]));
  }, []);
  const req = list?.[0];
  useEffect(() => { if (req) { setValues(toForm(req)); setErrors([]); } }, [req]);
  const showing = list === null || !!(req || done || waiting);
  useEffect(() => { holdPrompt("register", showing); return () => holdPrompt("register", false); }, [showing]);
  if (waiting) return <WaitingForInvite vessel={waiting.vessel} skipper={waiting.skipper} onOwnBoat={() => { stopWaiting(); setWaiting(null); }} />;
  if ((!req && !done) || !free) return null;

  const next = () => {
    if (done && !hasBoat && list.length <= 1 && !waitingOff()) setWaiting(done);
    setDone(null); setList((l) => l.slice(1));
  };
  const notNow = () => { sessionStorage.setItem(LATER_KEY, JSON.stringify([...later(), req.entry_id])); next(); };
  const submit = async () => {
    const miss = missing(values);
    if (miss.length) { setErrors(miss); toast.error("Every field is needed. Type None if something doesn't apply."); return; }
    setBusy(true);
    try {
      await api.put(`/crew-register/mine/${req.entry_id}`, toPayload(values));
      setDone({ skipper: req.skipper, vessel: req.vessel, crew: !!req.already_crew });
    } catch (err) { toast.error(apiError(err, "Couldn't save your registration, please try again")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && (done ? next() : notNow())}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-reg-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{done ? "Thank you for registering" : "Crew Registration"}</DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="crew-reg-intro">
            {done ? "Your crew registration is complete." : `${req.skipper} would like you to register as crew. You only do this once. Check or correct each field. Every field is needed, so type None if something doesn't apply.`}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center" data-testid="crew-reg-done">
            <CheckCircle2 className="h-28 w-28 text-[var(--green)]" strokeWidth={2.5} data-testid="crew-reg-done-tick" />
            <p className="text-base font-bold leading-relaxed" data-testid="crew-reg-done-note">
              The skipper of {done.vessel || `${done.skipper}'s boat`} will see that you have registered{done.crew ? "." : ", and a crew invite will follow in due course."}
            </p>
            <button type="button" className="btn-solid h-12 w-full justify-center" onClick={next} data-testid="crew-reg-done-btn">Close</button>
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
