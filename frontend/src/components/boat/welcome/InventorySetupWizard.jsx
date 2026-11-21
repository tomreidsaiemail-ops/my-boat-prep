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
const TITLES = { details: "Your boat", colours: "Magically place colours", blank: "Your blank schematic", done: "You're set up" };

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

const MapPanel = ({ boat, map, online, presets, onMaps, auto, blank, onNext }) => (
  <div className="flex flex-col gap-3" data-testid={blank ? "setup-blank-panel" : "setup-colours-panel"}>
    {blank
      ? <p className="text-sm">No matching schematic, so here is a blank one (the bow is on the right). Just drop the Galley, Saloon and some cabins onto it. Later you can replace it with a schematic from your boat&apos;s operating manual, or an image of your own.</p>
      : <p className="text-sm">The Magic Mariner is placing your zone colours on your schematic. Drag any that need nudging.</p>}
    {map && <OverviewMap boat={boat} map={map} src={boatMapUrl(boat, map)} canEdit online={online} presets={presets} onMaps={onMaps} autoStart={auto} big={blank} />}
    <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!(map?.swatches || []).length} onClick={onNext} data-testid="setup-colours-next-btn">
      {(map?.swatches || []).length ? <>Next <ArrowRight className="h-4 w-4" /></> : blank ? "Drop at least one colour first" : "Waiting for colours..."}
    </button>
  </div>
);

const DonePanel = ({ blank, onInventory, onClose }) => (
  <div className="flex flex-col gap-3" data-testid="setup-done-panel">
    <p className="flex items-start gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />
      {blank ? "You're set up using a blank schematic, with its colours on your Boat Inventory Zone Map Overview." : "You're set up. Your schematic and its colours are on your Boat Inventory Zone Map Overview."}</p>
    {blank && <p className="text-sm">When you have a schematic from your boat&apos;s operating manual, or an image of your own, add it in Boat Inventory with Create Zone Map Overview, then remove the blank one.</p>}
    {blank && <p className="text-sm" data-testid="setup-done-keep-note">You won&apos;t lose any cupboard definitions: just drag and drop your zones onto the new schematic again, or choose Magically Place Colours, which will do it for you.</p>}
    <p className="text-sm">Next, tap each colour (start with the Galley) to take photos of that zone and scan its cupboards.</p>
    <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={onInventory} data-testid="setup-open-inventory-btn"><Package className="h-4 w-4" />Open Boat Inventory</button>
    <button type="button" className="btn-ghost h-11 justify-center" onClick={onClose} data-testid="setup-back-welcome-btn">Back to Welcome</button>
  </div>
);

// Boat Inventory Set Up Wizard: boat details, the schematic search, Magically Place Colours (or a blank hull to drop colours on), then done.
export const InventorySetupWizard = ({ open, onClose, boat, details, online, onField, onMaps, onInventory }) => {
  const [step, setStep] = useState("details");
  const [draft, setDraft] = useState({});
  const [mapId, setMapId] = useState(null);
  const [presets, setPresets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [blank, setBlank] = useState(false);
  useEffect(() => {
    if (!open) return;
    setStep("details"); setMapId(null); setBlank(false);
    setDraft(Object.fromEntries(FIELDS.map((k) => [k, details[k] || ""])));
    if (online && !presets.length) api.get("/zone-colour-presets").then(({ data }) => setPresets(data.presets)).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const maps = boat.zone_maps || [];
  const map = maps.find((m) => m.id === mapId);
  const next = () => { FIELDS.forEach((k) => { if ((details[k] || "") !== draft[k]) onField(k, draft[k]); }); setStep("schematic"); };
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
      form.append("file", await (await fetch("/blank-hull.png")).blob(), "blank-schematic.png");
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
          {(step === "colours" || step === "blank") && <MapPanel boat={boat} map={map} online={online} presets={presets} onMaps={onMaps} auto={step === "colours"} blank={step === "blank"} onNext={() => setStep("done")} />}
          {step === "done" && <DonePanel blank={blank} onInventory={() => onInventory(mapId)} onClose={onClose} />}
        </DialogContent>
      </Dialog>
      <ZoneSchematicsDialog open={open && step === "schematic"} boat={{ ...details, ...draft }} boatId={boat.boat_id} online={online} extra={none}
        onDone={(all) => added(all, "colours")} onClose={() => setStep("details")} />
    </>
  );
};
