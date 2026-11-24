import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, RotateCcw, SkipForward } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { BoatTypeField, TextField } from "@/components/boat/AdditionalDetailsDialog";
import { identityFull } from "@/components/boat/zone/CreateOverviewButton";
import { ZoneTapPanel } from "@/components/boat/welcome/ZoneTapPanel";

const FIELDS = ["vessel", "boat_type", "make", "model", "year_built"];
// The blank schematic matching the boat type: 2 hulls for a catamaran, 3 for a trimaran, else a monohull.
const blankFor = (type) => (/trimaran/i.test(type || "") ? "/blank-trimaran.png" : /catamaran/i.test(type || "") ? "/blank-catamaran.png" : "/blank-hull.png");
const word = (w) => (l) => new RegExp(`\\b${w}\\b`, "i").test(l);
// Each tap step: one colour (Galley, Cockpit, Nav station) or every Admin colour naming that kind of space.
const ZONES = {
  galley: { one: /galley/i, text: "Tap the drawing roughly where the Galley is on your boat." },
  cockpit: { one: /cockpit/i, text: "Now tap roughly where the Cockpit is." },
  nav: { one: /nav station/i, text: "Tap roughly where the Nav Station is." },
  heads: { all: word("head"), text: "Tap a head's colour, then tap roughly where that head is. Do the same for each head on your boat." },
  cabins: { all: (l) => word("cabin")(l) && !/cabin top/i.test(l), text: "Tap a cabin's colour, then tap roughly where that cabin is. Do the same for each cabin on your boat." },
  engines: { all: word("engine room"), text: "Tap an engine room's colour, then tap roughly where it is." },
};
const ORDER = Object.keys(ZONES);
const coloursFor = (step, presets) => {
  const z = ZONES[step];
  if (z.all) return presets.filter((p) => z.all(p.label));
  const p = presets.find((x) => z.one.test(x.label));
  return p ? [p] : [];
};

const DetailsPanel = ({ draft, set, onNext }) => (
  <div className="flex flex-col gap-3" data-testid="setup-details-panel">
    <TextField id="setup-vessel" label="Boat name" value={draft.vessel} placeholder="e.g. Bacchus" onChange={(v) => set("vessel", v)} />
    <BoatTypeField value={draft.boat_type} onChange={(v) => set("boat_type", v)} />
    <div className="grid grid-cols-2 gap-2.5">
      <TextField id="setup-make" label="Make" value={draft.make} placeholder="e.g. Beneteau" onChange={(v) => set("make", v)} />
      <TextField id="setup-model" label="Model" value={draft.model} placeholder="e.g. Oceanis 38" onChange={(v) => set("model", v)} />
    </div>
    <label htmlFor="setup-year" className="flex flex-col gap-1">
      <span className="field-label">Year of manufacture</span>
      <input id="setup-year" inputMode="numeric" value={draft.year_built} placeholder="e.g. 2012" className="field-input"
        onChange={(e) => set("year_built", e.target.value.replace(/\D/g, "").slice(0, 4))} data-testid="setup-year-input" />
    </label>
    <p className="text-xs text-[var(--muted)]" data-testid="setup-details-note">These go on your boat and its Additional boat details. Boat type picks your blank schematic (monohull, catamaran or trimaran); you can swap in your own schematic later.</p>
    <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!identityFull(draft)} onClick={onNext} data-testid="setup-next-btn">
      Next <ArrowRight className="h-4 w-4" />
    </button>
  </div>
);

const Tick = ({ checked, onChange, label, testId }) => (
  <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold" data-testid={testId}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${testId}-checkbox`} /> {label}
  </label>
);

// Under the Cockpit: finish now (default) or go on to the other zones. Nav Station, Heads and Cabins: keep going, or untick to finish; Skip This goes on to the next zone.
const MoreZones = ({ step, more, setMore, onSkip }) => (
  <div className="flex flex-col" data-testid="setup-more-zones">
    {step === "cockpit" && <Tick checked={!more} onChange={() => setMore(false)} label="I will define other zones later with my own better schematic" testId="setup-zones-later" />}
    <Tick checked={more} onChange={(v) => setMore(step === "cockpit" ? true : v)} label="I'd like to define some other zones now" testId="setup-zones-now" />
    <button type="button" onClick={onSkip} className="flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-[var(--navy)] underline" data-testid="setup-skip-btn"><SkipForward className="h-4 w-4" />Skip This</button>
  </div>
);

const Nav = ({ onBack, onNext, label, disabled }) => (
  <div className="grid grid-cols-[auto_1fr] gap-2">
    <button type="button" className="btn-ghost h-12 justify-center gap-1.5 px-4" onClick={onBack} data-testid="setup-back-btn"><ArrowLeft className="h-4 w-4" />Back</button>
    <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={disabled} onClick={onNext} data-testid="setup-tap-next-btn">
      {label === "Finish" ? <><Check className="h-4 w-4" />Finish</> : <>{label}{label === "Next" && <ArrowRight className="h-4 w-4" />}</>}
    </button>
  </div>
);

// Boat Inventory Set Up Wizard: boat details (only when any are missing), then the blank schematic for the boat type (or the boat's own schematic, if it has one),
// tapping on the Galley, the Cockpit and, if wanted, the Nav Station, Heads, Cabins and Engine rooms. Finish gives the zones their usual cupboards and opens the Galley.
// onZoneDefaults(swatches): gives the placed zones their usual cupboards, returns how many were added or filed.
export const InventorySetupWizard = ({ open, onClose, boat, details, online, onField, onMaps, onInventory, onZoneDefaults }) => {
  const [step, setStep] = useState("details");
  const [draft, setDraft] = useState({});
  const [mapId, setMapId] = useState(null);
  const [presets, setPresets] = useState([]);
  const [blank, setBlank] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMapId(null); setBlank(false); setMore(false);
    const d = Object.fromEntries(FIELDS.map((k) => [k, details[k] || ""]));
    setDraft(d);
    if (identityFull(d) && d.vessel.trim()) go(d); else setStep("details");
    if (online && !presets.length) api.get("/zone-colour-presets").then(({ data }) => setPresets(data.presets)).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const maps = boat.zone_maps || [];
  const map = maps.find((m) => m.id === mapId);
  const addBlank = async (type) => {
    setStep("loading");
    if (!online) { toast.error("Adding the blank schematic needs a signal"); setStep("failed"); return; }
    try {
      const form = new FormData();
      form.append("file", await (await fetch(blankFor(type))).blob(), "blank-schematic.png");
      form.append("kind", "overview");
      const all = (await api.post(`/boats/${boat.boat_id}/zone-maps`, form, { timeout: 60000 })).data.zone_maps;
      const before = new Set(maps.map((m) => m.id));
      onMaps(all); setMapId((all.filter((x) => x.kind === "overview" && !before.has(x.id)).pop() || all.filter((x) => x.kind === "overview").pop())?.id || null);
      setBlank(true); setStep("galley");
    } catch (e) { toast.error(apiError(e, "Couldn't add the blank schematic")); setStep("failed"); }
  };
  // The boat's own schematic if it has one (the one with colours first), else a blank one for its type.
  const go = (d = draft) => {
    const ov = maps.filter((m) => m.kind === "overview");
    const cur = ov.find((m) => (m.swatches || []).length) || ov[ov.length - 1];
    if (cur) { setMapId(cur.id); setStep("galley"); } else addBlank(d.boat_type || details.boat_type);
  };
  const next = () => { FIELDS.forEach((k) => { if ((details[k] || "") !== draft[k]) onField(k, draft[k]); }); go(); };
  const finish = () => {
    const n = onZoneDefaults(map?.swatches || []);
    if (n) toast.success(`Each zone has its usual cupboards (${n} in all), like the Fridge and Freezer in the Galley. Rename or remove any you don't have.`, { duration: 6000 });
    onInventory(mapId);
  };
  const i = ORDER.indexOf(step);
  const tapping = i >= 0 && map;
  const colours = tapping ? coloursFor(step, presets) : [];
  const placed = (map?.swatches || []).some((s) => colours.some((c) => c.label === s.label));
  const ends = step === "engines" || (step !== "galley" && !more);
  const forward = () => (ends ? finish() : setStep(ORDER[i + 1]));
  const skip = () => { if (step === "cockpit") forward(); else { setMore(true); setStep(ORDER[i + 1]); } };
  const title = step === "details" ? "Your boat" : blank || ["loading", "failed"].includes(step) ? "Your blank schematic" : "Your schematic";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`flex max-h-[92vh] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)] ${tapping && blank ? "max-sm:p-3" : ""}`} data-testid="inventory-setup-wizard" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold" data-testid="setup-title">Boat Inventory Set Up: {title}</DialogTitle>
          <DialogDescription className="text-left text-xs">Boat Inventory Set Up Wizard</DialogDescription>
        </DialogHeader>
        {step === "details" && <DetailsPanel draft={draft} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} onNext={next} />}
        {step === "loading" && <p className="flex items-center gap-2 text-sm" data-testid="setup-loading"><Loader2 className="h-4 w-4 animate-spin" />Getting your blank schematic...</p>}
        {step === "failed" && <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={() => go()} data-testid="setup-retry-btn"><RotateCcw className="h-4 w-4" />Try again</button>}
        {tapping && <>
          <ZoneTapPanel key={step} boat={boat} map={map} online={online} colours={colours} big={blank} onMaps={onMaps}
            text={`${ZONES[step].text}${step === "galley" && blank ? " The bow is on the right." : ""}`} />
          {!["galley", "engines"].includes(step) && <MoreZones step={step} more={more} setMore={setMore} onSkip={skip} />}
          <Nav onBack={() => setStep(i ? ORDER[i - 1] : "details")} onNext={forward} label={ends ? "Finish" : step === "galley" && colours.length && !placed ? "Tap the Galley on the drawing first" : "Next"}
            disabled={step === "galley" && colours.length > 0 && !placed} />
        </>}
      </DialogContent>
    </Dialog>
  );
};
