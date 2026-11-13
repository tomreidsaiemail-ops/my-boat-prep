import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Search, Sparkles } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";
import { CropDialog, useCropStep } from "@/components/boat/zone/CropDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ZoneSchematicsDialog } from "@/components/boat/zone/ZoneSchematicsDialog";

// Boat type, make, model and year are needed to search the web for the boat's schematic.
export const identityFull = (b = {}) => !!(b.boat_type?.trim() && b.make?.trim() && b.model?.trim() && /^\d{4}$/.test(b.year_built || ""));
const OPEN_DETAILS = "mbp:open-boat-details-for-zone";
export const RESUME_ZONE = "mbp:zone-overview-create";
export const askDetailsForZone = () => window.dispatchEvent(new Event(OPEN_DETAILS));
export const onAskDetailsForZone = (fn) => { window.addEventListener(OPEN_DETAILS, fn); return () => window.removeEventListener(OPEN_DETAILS, fn); };

// "Create Zone Map Overview (Schematic)": fill in the boat details first; with an overview already there, upload your own
// schematic/photo or search the web again. New overviews always go after the existing ones.
export const CreateOverviewButton = ({ boat, details, online, count, max, onMaps }) => {
  const [choose, setChoose] = useState(false);
  const [plans, setPlans] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const overviews = (boat?.zone_maps || []).filter((m) => m.kind === "overview").length;
  const start = () => {
    if (!identityFull(details)) { toast.message("First add your boat type, make, model and year of manufacture"); askDetailsForZone(); return; }
    if (!online) { toast.error("Creating a Zone Map Overview needs a signal"); return; }
    if (count >= max) { toast.error(`${max} of ${max} maps used. Remove one to add another.`); return; }
    if (overviews) setChoose(true); else setPlans(true);
  };
  const latest = useRef(start);
  latest.current = start;
  useEffect(() => {
    const resume = () => latest.current();
    window.addEventListener(RESUME_ZONE, resume);
    return () => window.removeEventListener(RESUME_ZONE, resume);
  }, []);
  const step = useCropStep();
  const save = async (blob) => {
    const form = new FormData();
    form.append("file", blob, "zone-overview.jpg");
    form.append("kind", "overview");
    setBusy(true);
    try { const maps = (await api.post(`/boats/${boat.boat_id}/zone-maps`, form, { timeout: 60000 })).data.zone_maps; step.close(); onMaps(maps); toast.success("Your Zone Map Overview was added after the existing one"); }
    catch (e2) { toast.error(apiError(e2, "Couldn't save the Zone Map Overview")); } finally { setBusy(false); }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { step.open(await shrink(file, 2400), save); } catch { toast.error("That file doesn't look like a picture"); }
  };
  return (
    <>
      <button type="button" className="btn-solid h-11 justify-center gap-2 text-sm" disabled={busy} onClick={start} data-testid="zone-overview-create-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create Zone Map Overview (Schematic)
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="zone-overview-upload-input" />
      <CropDialog src={step.crop?.src} busy={busy} onSave={(b) => step.crop?.save(b)} onCancel={step.close} />
      <Dialog open={choose} onOpenChange={(o) => !o && setChoose(false)}>
        <DialogContent className="flex max-w-sm flex-col gap-3 rounded-lg border-2 border-[var(--navy)]" data-testid="zone-overview-choice-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold">Add another Zone Map Overview</DialogTitle>
            <DialogDescription className="text-left">You already have {overviews === 1 ? "a Zone Map Overview" : `${overviews} Zone Map Overviews`}. The new one is added after {overviews === 1 ? "it" : "them"}.</DialogDescription>
          </DialogHeader>
          <button type="button" className="btn-ghost h-12 justify-center gap-2" onClick={() => { setChoose(false); input.current?.click(); }} data-testid="zone-overview-upload-btn">
            <ImagePlus className="h-4 w-4" /> Upload my own schematic or photo
          </button>
          <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={() => { setChoose(false); setPlans(true); }} data-testid="zone-overview-magic-btn">
            <Search className="h-4 w-4" /> Search the web for my schematic
          </button>
        </DialogContent>
      </Dialog>
      <ZoneSchematicsDialog open={plans} boat={details} boatId={boat.boat_id} online={online} onDone={(maps) => { onMaps(maps); setPlans(false); }} onClose={() => setPlans(false)} />
    </>
  );
};
