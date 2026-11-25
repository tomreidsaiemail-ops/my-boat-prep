import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";
import { CropDialog, useCropStep } from "@/components/boat/zone/CropDialog";

// Swaps in a better picture for this schematic: the new one is saved first, and its colours stay on (move them to the right spots).
export const ReplaceSchematicButton = ({ boat, map, online, onMaps, t }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const step = useCropStep();
  const save = async (blob) => {
    const form = new FormData();
    form.append("file", blob, "zone-overview.jpg");
    setBusy(true);
    try {
      onMaps((await api.put(`/boats/${boat.boat_id}/zone-maps/${map.id}/image`, form, { timeout: 60000 })).data.zone_maps);
      step.close();
      toast.success("Schematic replaced. Your colours are kept, drag them to their correct positions.");
    } catch (e) { toast.error(apiError(e, "Couldn't replace the schematic")); }
    setBusy(false);
  };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { step.open(await shrink(file, 2400), save); } catch { toast.error("That file doesn't look like a picture"); }
  };
  const open = () => (online ? input.current?.click() : toast.error("You need a signal to replace the schematic"));
  return (
    <>
      <button type="button" className="btn-ghost h-9 px-3 text-xs" disabled={busy} onClick={open} data-testid={`${t}-replace-btn`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Replace with a better schematic
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid={`${t}-replace-input`} />
      <CropDialog src={step.crop?.src} busy={busy} onSave={(b) => step.crop?.save(b)} onCancel={step.close} />
    </>
  );
};
