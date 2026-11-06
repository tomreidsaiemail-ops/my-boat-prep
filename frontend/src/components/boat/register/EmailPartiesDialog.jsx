import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { RegStatus } from "@/components/boat/register/RegStatus";

const Pick = ({ type, checked, onChange, entry, testId }) => (
  <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-3 py-2" data-testid={testId}>
    <input type={type} name={type === "radio" ? "party" : undefined} checked={checked} onChange={onChange} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${testId}-input`} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold">{entry.name}</span>
      <span className="block truncate text-xs text-[var(--muted)]">{entry.email}</span>
    </span>
    {type === "checkbox" && <RegStatus status={entry.status} testId={`${testId}-status`} />}
  </label>
);

// Step 1: tick today's crew. Step 2: pick the one interested party to email their details to.
export const EmailPartiesDialog = ({ open, reg, onClose }) => {
  const [crew, setCrew] = useState([]);
  const [party, setParty] = useState("");
  const [medical, setMedical] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setCrew([]); setParty(""); setMedical(false); } }, [open]);
  const toggle = (id) => setCrew((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const not = reg.crew.filter((c) => crew.includes(c.entry_id) && c.status !== "registered").map((c) => c.name);

  const send = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/crew-register/parties-email", { crew_ids: crew, party_id: party, include_allergies: medical }, { timeout: 30000 });
      toast.success(`Details for ${data.crew} crew emailed to ${data.sent_to}`);
      onClose();
    } catch (err) { toast.error(apiError(err, "Couldn't email the crew details, please try again")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="email-parties-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Email crew details</DialogTitle>
          <DialogDescription className="text-left text-sm">Sends each crew member's name, phone, email, age, height and next of kin (and allergies, if you tick medical details) to one interested party.</DialogDescription>
        </DialogHeader>
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="field-label">1. Who's crewing</p>
            <button type="button" className="text-xs font-bold underline" onClick={() => setCrew(crew.length === reg.crew.length ? [] : reg.crew.map((c) => c.entry_id))} data-testid="email-parties-crew-all-btn">
              {crew.length === reg.crew.length ? "Clear" : "Tick all"}
            </button>
          </div>
          <div className="divide-y divide-[var(--line)] rounded-md border-[1.5px] border-[var(--line)]" data-testid="email-parties-crew-list">
            {reg.crew.map((c) => <Pick key={c.entry_id} type="checkbox" entry={c} checked={crew.includes(c.entry_id)} onChange={() => toggle(c.entry_id)} testId={`email-parties-crew-${c.entry_id}`} />)}
          </div>
        </section>
        {crew.length > 0 && (
          <section className="flex flex-col gap-1.5" data-testid="email-parties-party-step">
            <p className="field-label">2. Send to</p>
            <div className="divide-y divide-[var(--line)] rounded-md border-[1.5px] border-[var(--line)]" data-testid="email-parties-party-list">
              {reg.parties.map((p) => <Pick key={p.entry_id} type="radio" entry={p} checked={party === p.entry_id} onChange={() => setParty(p.entry_id)} testId={`email-parties-party-${p.entry_id}`} />)}
            </div>
          </section>
        )}
        {crew.length > 0 && (
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-md border-[1.5px] border-[var(--line)] px-3 py-2" data-testid="email-parties-medical">
            <input type="checkbox" checked={medical} onChange={(e) => setMedical(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="email-parties-medical-input" />
            <span className="text-sm"><b>Include medical details</b><span className="block text-xs text-[var(--muted)]">Adds each crew member's allergies, e.g. for the race committee or Coast Guard.</span></span>
          </label>
        )}
        {not.length > 0 && (
          <p role="alert" className="rounded-md border-[1.5px] border-amber-400 bg-amber-50 p-2.5 text-sm" data-testid="email-parties-unregistered-warn">
            <b>{not.join(", ")}</b> {not.length === 1 ? "hasn't" : "haven't"} completed registration yet, so their details may be missing or out of date. You can still send.
          </p>
        )}
        <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={busy || !crew.length || !party} onClick={send} data-testid="email-parties-send-btn">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {!crew.length ? "Tick the crew first" : !party ? "Pick who to send to" : not.length ? "Send anyway" : "Send crew details"}
        </button>
      </DialogContent>
    </Dialog>
  );
};
