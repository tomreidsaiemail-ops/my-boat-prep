import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Map, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, API, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

const mapUrl = (v) => `${API}/inventory/zone-map?v=${encodeURIComponent(v)}`;

const AdminTools = ({ has, online, onChanged }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    if (!online) { toast.error("You need a signal to change the zone map"); return; }
    setBusy(true);
    try { onChanged((await fn()).data.zone_map_v); toast.success(ok); } catch (e) { toast.error(apiError(e, "Couldn't update the zone map")); } finally { setBusy(false); }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let blob;
    try { blob = await shrink(file, 1600); } catch { toast.error("That file doesn't look like a picture"); return; }
    const form = new FormData();
    form.append("file", blob, "zone-map.jpg");
    run(() => api.post("/admin/inventory/zone-map", form, { timeout: 60000 }), "Zone map saved for every skipper");
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-ghost h-10 px-3 text-sm" disabled={busy} onClick={() => input.current?.click()} data-testid="zone-map-upload-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {has ? "Replace zone map" : "Upload zone map"}
      </button>
      {has && (
        <button type="button" className="btn-ghost h-10 px-3 text-sm hover:text-[var(--red)]" disabled={busy} data-testid="zone-map-remove-btn"
          onClick={() => run(() => api.delete("/admin/inventory/zone-map"), "Zone map removed")}><Trash2 className="h-4 w-4" /> Remove</button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="zone-map-input" />
    </div>
  );
};

export const ZoneMap = ({ version, admin, online, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(null);
  const show = version && failed !== version;
  if (!show && !admin) return null;
  return (
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="zone-map">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]"><Map className="h-4 w-4" /> Zone map</h2>
      {show ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="Open zone map full size" data-testid="zone-map-open-btn">
          <img src={mapUrl(version)} alt="Boat zone map" className="max-h-64 w-full rounded-md object-contain" onError={() => setFailed(version)} data-testid="zone-map-img" />
        </button>
      ) : <p className="text-sm text-[var(--muted)]" data-testid="zone-map-empty">No zone map yet. Upload a layout picture showing your cupboards and lockers.</p>}
      {admin && <AdminTools has={!!show} online={online} onChanged={onChanged} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl rounded-lg border-2 border-[var(--navy)] p-2" data-testid="zone-map-dialog" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Zone map</DialogTitle>
          {show && <img src={mapUrl(version)} alt="Boat zone map" className="max-h-[80vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </section>
  );
};
