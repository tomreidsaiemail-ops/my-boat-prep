import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { api, apiError } from "@/lib/api";
import { MAINT_CATEGORY, MAINT_LISTS, STARTER, attrsForList, boatTitle, looksLikeSailboat } from "@/lib/maint";

const boatBody = (b) => ({ make: (b.make || "").trim(), model: (b.model || "").trim(), boat_type: (b.boat_type || "").trim(), year_built: /^\d{4}$/.test(b.year_built || "") ? b.year_built : "", loa: String(b.loa || "").slice(0, 8), units: b.units === "ft" ? "ft" : "m" });

// The Magic Mariner checks the boat is a sailboat, then offers the five Boat Maintenance lists (tailored for Pro, starter items otherwise).
export const MaintSetupDialog = ({ boat, premium, online, defs, auto, onCreate, onDismiss, onClose }) => {
  const magic = premium && online;
  const [step, setStep] = useState(magic ? "checking" : looksLikeSailboat(boat) ? "offer" : "notSail");
  const name = boatTitle(boat);
  const [picked, setPicked] = useState(MAINT_LISTS.map((l) => l.key));
  const [due, setDue] = useState("");
  useEffect(() => {
    if (step === "notSail" && auto) onDismiss();
  }, [step, auto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!magic) return;
    api.post("/ai/boat-kind", boatBody(boat), { timeout: 45000 })
      .then(({ data }) => setStep(data.sailboat ? "offer" : "notSail"))
      .catch(() => setStep(looksLikeSailboat(boat) ? "offer" : "notSail"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  const create = async () => {
    const chosen = MAINT_LISTS.filter((l) => picked.includes(l.key));
    let tailored = {};
    if (magic) {
      setStep("making");
      const attrs = Object.fromEntries(chosen.map((l) => [l.key, attrsForList(defs, { maint: l.key, name: l.name }).filter((d) => d.type === "picklist")
        .map((d) => ({ key: d.key, name: d.name.slice(0, 80), options: d.options.slice(0, 60) }))]));
      try {
        tailored = (await api.post("/ai/maint-lists", { ...boatBody(boat), lists: chosen.map((l) => l.key), attrs }, { timeout: 120000 })).data.lists;
      } catch (err) { toast.error(`${apiError(err, "The Magic Mariner couldn't tailor the lists")} Starter items were used instead.`); }
    }
    onCreate(chosen.map((l) => ({ ...l, groups: tailored[l.key] || STARTER[l.key] })), due);
  };
  if (step === "notSail" && auto) return null;
  const listNames = MAINT_LISTS.map((l) => l.name);
  return (
    <Dialog open onOpenChange={(o) => !o && step !== "making" && (step === "offer" ? onDismiss() : onClose())}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" data-testid="maint-setup-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><Sparkles className="h-5 w-5 shrink-0" /> Boat Maintenance lists</DialogTitle>
          <DialogDescription className="sr-only">Set up maintenance lists for your boat</DialogDescription>
        </DialogHeader>
        {(step === "checking" || step === "making") && (
          <p className="flex items-center gap-2 py-6 text-sm font-semibold" data-testid="maint-setup-busy">
            <Loader2 className="h-5 w-5 animate-spin" /> {step === "checking" ? `The Magic Mariner is checking your ${name}...` : `The Magic Mariner is making lists for your ${name}...`}
          </p>
        )}
        {step === "notSail" && (
          <p className="text-sm" data-testid="maint-setup-not-sail">The Magic Mariner doesn&apos;t think your {name} is a sailboat. These lists cover sails, rigging and deck hardware, so they suit sailing boats best.</p>
        )}
        {step === "offer" && (
          <div className="flex flex-col gap-3 text-sm" data-testid="maint-setup-offer">
            <p className="font-semibold" data-testid="maint-setup-question">
              Would you like default {listNames.slice(0, -1).join(", ")} and {listNames.at(-1)} lists created for your {name}?
            </p>
            <p className="rounded-md border-l-4 border-[var(--navy)] bg-slate-50 px-3 py-2 text-[var(--muted)]" data-testid="maint-setup-guidance">
              Recommended: it&apos;s the easiest way to review, correct and configure your boat&apos;s gear. The lists go in the {MAINT_CATEGORY} category.
              {!premium && " Pro skippers get items tailored to their boat by the Magic Mariner; you'll get standard starter items."}
              {premium && !online && " You're offline, so you'll get standard starter items."}
            </p>
            <div className="flex flex-col gap-2">
              {MAINT_LISTS.map((l) => (
                <label key={l.key} className="flex min-h-[36px] items-center gap-2 font-semibold">
                  <Checkbox checked={picked.includes(l.key)} onCheckedChange={() => toggle(l.key)} data-testid={`maint-setup-pick-${l.key}`} /> {l.name}
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1">
              <span className="field-label">Service due date (optional)</span>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="field-input" data-testid="maint-setup-due-input" />
              <span className="text-xs text-[var(--muted)]">Applies to every category. You can change it for any category or item later.</span>
            </label>
          </div>
        )}
        {step !== "checking" && step !== "making" && (
          <DialogFooter className="flex-row justify-end gap-2">
            <button type="button" className="btn-ghost px-4" onClick={step === "offer" ? onDismiss : onClose} data-testid="maint-setup-cancel-btn">Not now</button>
            <button type="button" className="btn-solid px-4" onClick={step === "notSail" ? () => setStep("offer") : create} disabled={step === "offer" && !picked.length} data-testid="maint-setup-create-btn">
              {step === "notSail" ? "Show me anyway" : "Create lists"}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
