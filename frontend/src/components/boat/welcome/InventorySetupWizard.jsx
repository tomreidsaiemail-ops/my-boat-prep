import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, Package, PenLine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { BoatTypeField, TextField } from "@/components/boat/AdditionalDetailsDialog";
import { identityFull } from "@/components/boat/zone/CreateOverviewButton";
import { ZoneSchematicsDialog } from "@/components/boat/zone/ZoneSchematicsDialog";
import { OverviewMap } from "@/components/boat/zone/OverviewMap";
import { boatMapUrl } from "@/components/boat/ZoneMap";

const FIELDS = ["vessel", "boat_type", "make", "model", "year_built"];
// The blank schematic matching the boat type: 2 hulls for a catamaran, 3 for a trimaran, else a monohull.
const blankFor = (type) => (/trimaran/i.test(type || "") ? "/blank-trimaran.png" : /catamaran/i.test(type || "") ? "/blank-catamaran.png" : "/blank-hull.png");
const TITLES = { details: "Your boat", colours: "Magically place colours", blank: "Your blank schematic", current: "Your schematic", done: "You're set up" };

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
    <p className="text-xs text-[var(--muted)]">These go on your boat and its Additional boat details. Type, make, model and year let us find your boat&apos;s schematic.</p>
    <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!identityFull(draft)} onClick={onNext} data-testid="setup-next-btn">
      Next <ArrowRight className="h-4 w-4" />
    </button>
  </div>
);

const MapPanel = ({ boat, map, online, presets, onMaps, auto, blank, current, onNext, onZoneDefaults }) => (
  <div className="flex flex-col gap-3" data-testid={current ? "setup-current-panel" : blank ? "setup-blank-panel" : "setup-colours-panel"}>
    {current && <p className="text-sm">Here is your current schematic. Check its zone colours (drag any that need nudging), then Next gives each zone its usual cupboards.</p>}
    {!current && (blank
      ? <p className="text-sm">No matching schematic, so here is a blank one (the bow is on the right). Just drop the Galley, Saloon and some cabins onto it. Later you can replace it with a schematic from your boat&apos;s operating manual, or an image of your own.</p>
      : <p className="text-sm">The Magic Mariner is placing your zone colours on your schematic. Drag any that need nudging.</p>)}
    {map && <OverviewMap boat={boat} map={map} src={boatMapUrl(boat, map)} canEdit online={online} presets={presets} onMaps={onMaps} onZoneDefaults={onZoneDefaults} autoStart={auto} big={blank} />}
    <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!(map?.swatches || []).length} onClick={onNext} data-testid="setup-colours-next-btn">
      {(map?.swatches || []).length ? <>Next <ArrowRight className="h-4 w-4" /></> : blank || current ? "Drop at least one colour first" : "Waiting for colours..."}
    </button>
  </div>
);

const DonePanel = ({ blank, made, onInventory, onClose }) => (
  <div className="flex flex-col gap-3" data-testid="setup-done-panel">
    <p className="flex items-start gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />
      {blank ? "You're set up using a blank schematic, with its colours on your Boat Inventory Zone Map Overview." : "You're set up. Your schematic and its colours are on your Boat Inventory Zone Map Overview."}</p>
    {made > 0 && <p className="text-sm" data-testid="setup-done-cupboards">Each zone has its usual cupboards ({made} in all), like the Fridge and Freezer in the Galley. Rename or remove any you don&apos;t have.</p>}
    {blank && <p className="text-sm">When you have a schematic from your boat&apos;s operating manual, or an image of your own, add it in Boat Inventory with Create Zone Map Overview, then remove the blank one.</p>}
    {blank && <p className="text-sm" data-testid="setup-done-keep-note">You won&apos;t lose any cupboard definitions: just drag and drop your zones onto the new schematic again, or choose Magically Place Colours, which will do it for you.</p>}
    <p className="text-sm">Next, tap each colour (start with the Galley) to take photos of that zone and scan its cupboards.</p>
    <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={onInventory} data-testid="setup-open-inventory-btn"><Package className="h-4 w-4" />Open Boat Inventory</button>
    <button type="button" className="btn-ghost h-11 justify-center" onClick={onClose} data-testid="setup-back-welcome-btn">Back to Welcome</button>
  </div>
);

// Boat Inventory Set Up Wizard: boat details (only when any are missing), the schematic search, Magically Place Colours (or a blank hull to drop colours on), then done.
// A boat that already has a schematic skips the search: it shows that schematic, then Next gives its zones their usual cupboards.
// onZoneDefaults(swatches): gives the placed zones their usual cupboards, returns how many were added or filed.
export const InventorySetupWizard = ({ open, onClose, boat, details, online, onField, onMaps, onInventory, onZoneDefaults }) => {
  const [step, setStep] = useState("details");
  const [draft, setDraft] = useState({});
  const [mapId, setMapId] = useState(null);
  const [presets, setPresets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [blank, setBlank] = useState(false);
  const [made, setMade] = useState(0);
  const zoneDefaults = (sw) => { const n = onZoneDefaults(sw); setMade((m) => m + n); return n; };
  useEffect(() => {
    if (!open) return;
    setMapId(null); setBlank(false); setMade(0);
    const d = Object.fromEntries(FIELDS.map((k) => [k, details[k] || ""]));
    setDraft(d);
    if (identityFull(d) && d.vessel.trim()) go(); else setStep("details");
    if (online && !presets.length) api.get("/zone-colour-presets").then(({ data }) => setPresets(data.presets)).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const maps = boat.zone_maps || [];
  const map = maps.find((m) => m.id === mapId);
  const go = () => {
    const ov = maps.filter((m) => m.kind === "overview");
    const cur = ov.find((m) => (m.swatches || []).length) || ov[ov.length - 1];
    if (cur) { setMapId(cur.id); setStep("current"); } else setStep("schematic");
  };
  const next = () => { FIELDS.forEach((k) => { if ((details[k] || "") !== draft[k]) onField(k, draft[k]); }); go(); };
  const added = (all, to) => {
    const before = new Set(maps.map((m) => m.id));
    const m = all.filter((x) => x.kind === "overview" && !before.has(x.id)).pop() || all.filter((x) => x.kind === "overview").pop();
    onMaps(all); setMapId(m?.id || null); setStep(to);
  };
  const useBlank = async () => {
    if (!online) { toast.error("Adding the blank schematic needs a signal"); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", await (await fetch(blankFor(draft.boat_type || details.boat_type))).blob(), "blank-schematic.png");
      form.append("kind", "overview");
      added((await api.post(`/boats/${boat.boat_id}/zone-maps`, form, { timeout: 60000 })).data.zone_maps, "blank");
      setBlank(true);
    } catch (e) { toast.error(apiError(e, "Couldn't add the blank schematic")); }
    setBusy(false);
  };
  const none = (
    <button type="button" className="btn-ghost h-12 justify-center gap-2" disabled={busy} onClick={useBlank} data-testid="setup-no-schematic-btn">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />} None of these fit my boat: use a blank schematic
    </button>
  );
  return (
    <>
      <Dialog open={open && step !== "schematic"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className={`flex max-h-[92vh] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)] ${step === "blank" ? "max-sm:p-3" : ""}`} data-testid="inventory-setup-wizard" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold" data-testid="setup-title">Boat Inventory Set Up: {TITLES[step]}</DialogTitle>
            <DialogDescription className="text-left text-xs">Boat Inventory Set Up Wizard</DialogDescription>
          </DialogHeader>
          {step === "details" && <DetailsPanel draft={draft} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} onNext={next} />}
          {["colours", "blank", "current"].includes(step) && <MapPanel boat={boat} map={map} online={online} presets={presets} onMaps={onMaps} auto={step === "colours"} blank={step === "blank"} current={step === "current"} onZoneDefaults={zoneDefaults}
            onNext={() => { zoneDefaults(map?.swatches || []); setStep("done"); }} />}
          {step === "done" && <DonePanel blank={blank} made={made} onInventory={() => onInventory(mapId)} onClose={onClose} />}
        </DialogContent>
      </Dialog>
      <ZoneSchematicsDialog open={open && step === "schematic"} boat={{ ...details, ...draft }} boatId={boat.boat_id} online={online} extra={none}
        onDone={(all) => added(all, "colours")} onClose={() => setStep("details")} />
    </>
  );
};
