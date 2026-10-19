import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Map, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, API, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

const mapUrl = (v) => `${API}/inventory/zone-map?v=${encodeURIComponent(v)}`;
const MAX_MAPS = 3;
const boatMapUrl = (b, m) => `${API}/boats/${b.boat_id}/zone-maps/${m.id}?${b.owner_id ? `owner=${encodeURIComponent(b.owner_id)}&` : ""}v=${encodeURIComponent(m.v)}`;

const pickPicture = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return null;
  try { return await shrink(file, 1600); } catch { toast.error("That file doesn't look like a picture"); return null; }
};

const OwnerTools = ({ boat, count, online, onMaps }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const blob = await pickPicture(e);
    if (!blob) return;
    if (!online) { toast.error("You need a signal to upload a zone map"); return; }
    const form = new FormData();
    form.append("file", blob, "zone-map.jpg");
    setBusy(true);
    try { onMaps((await api.post(`/boats/${boat.boat_id}/zone-maps`, form, { timeout: 60000 })).data.zone_maps); toast.success("Zone map saved for this boat"); }
    catch (e2) { toast.error(apiError(e2, "Couldn't save the zone map")); } finally { setBusy(false); }
  };
  if (count >= MAX_MAPS) return <p className="text-xs text-[var(--muted)]" data-testid="boat-zone-map-limit">{MAX_MAPS} of {MAX_MAPS} maps used. Remove one to add another.</p>;
  return (
    <>
      <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" disabled={busy} onClick={() => input.current?.click()} data-testid="boat-zone-map-upload-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {count ? `Add another map (${count}/${MAX_MAPS})` : "Upload my boat's zone map"}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="boat-zone-map-input" />
    </>
  );
};

const AdminTools = ({ has, online, onChanged }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    if (!online) { toast.error("You need a signal to change the zone map"); return; }
    setBusy(true);
    try { onChanged((await fn()).data.zone_map_v); toast.success(ok); } catch (e) { toast.error(apiError(e, "Couldn't update the zone map")); } finally { setBusy(false); }
  };
  const upload = async (e) => {
    const blob = await pickPicture(e);
    if (!blob) return;
    const form = new FormData();
    form.append("file", blob, "zone-map.jpg");
    run(() => api.post("/admin/inventory/zone-map", form, { timeout: 60000 }), "Default zone map saved for every skipper");
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-ghost h-10 px-3 text-sm" disabled={busy} onClick={() => input.current?.click()} data-testid="zone-map-upload-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {has ? "Replace default map" : "Upload default map"}
      </button>
      {has && (
        <button type="button" className="btn-ghost h-10 px-3 text-sm hover:text-[var(--red)]" disabled={busy} data-testid="zone-map-remove-btn"
          onClick={() => run(() => api.delete("/admin/inventory/zone-map"), "Zone map removed")}><Trash2 className="h-4 w-4" /> Remove</button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="zone-map-input" />
    </div>
  );
};

export const ZoneMap = ({ version, admin, online, onChanged, boat, canEdit, onBoatMaps }) => {
  const [open, setOpen] = useState(null);
  const [failed, setFailed] = useState({});
  const [removing, setRemoving] = useState(null);
  const own = (boat?.zone_maps || []).filter((m) => !failed[m.id]);
  const pics = own.length ? own.map((m) => ({ key: m.id, src: boatMapUrl(boat, m), map: m }))
    : version && !failed.admin ? [{ key: "admin", src: mapUrl(version) }] : [];
  if (!pics.length && !admin && !canEdit) return null;
  const removeMap = async (m) => {
    if (!online) { toast.error("You need a signal to remove a zone map"); return; }
    setRemoving(m.id);
    try { onBoatMaps((await api.delete(`/boats/${boat.boat_id}/zone-maps/${m.id}`)).data.zone_maps); toast.success("Zone map removed"); }
    catch (e) { toast.error(apiError(e, "Couldn't remove the zone map")); } finally { setRemoving(null); }
  };
  return (
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="zone-map">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]"><Map className="h-4 w-4" /> {own.length > 1 ? "Zone maps" : "Zone map"}</h2>
      {pics.map((p, n) => (
        <div key={p.key} className="flex flex-col gap-1" data-testid={`zone-map-item-${p.key}`}>
          <button type="button" onClick={() => setOpen(p.src)} aria-label={`Open zone map ${n + 1} full size`} data-testid={p.key === "admin" ? "zone-map-open-btn" : `boat-zone-map-open-${p.key}`}>
            <img src={p.src} alt={`Boat zone map ${n + 1}`} className="max-h-64 w-full rounded-md object-contain" onError={() => setFailed((f) => ({ ...f, [p.key]: true }))}
              data-testid={p.key === "admin" ? "zone-map-img" : `boat-zone-map-img-${p.key}`} />
          </button>
          {p.map && canEdit && (
            <button type="button" className="btn-ghost h-9 self-end px-3 text-xs hover:text-[var(--red)]" disabled={removing === p.key} onClick={() => removeMap(p.map)} data-testid={`boat-zone-map-remove-${p.key}`}>
              {removing === p.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove this map
            </button>
          )}
        </div>
      ))}
      {!pics.length && <p className="text-sm text-[var(--muted)]" data-testid="zone-map-empty">No zone map yet. Upload a layout picture showing your cupboards and lockers.</p>}
      {own.length === 0 && pics.length > 0 && canEdit && <p className="text-xs text-[var(--muted)]" data-testid="zone-map-default-note">This is the standard map. Upload your own boat's map to use it here instead.</p>}
      {canEdit && <OwnerTools boat={boat} count={own.length} online={online} onMaps={onBoatMaps} />}
      {admin && (
        <div className="flex flex-col gap-1 border-t border-[var(--line)] pt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Default map for skippers without their own</p>
          <AdminTools has={!!version} online={online} onChanged={onChanged} />
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl rounded-lg border-2 border-[var(--navy)] p-2" data-testid="zone-map-dialog" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Zone map</DialogTitle>
          {open && <img src={open} alt="Boat zone map" className="max-h-[80vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </section>
  );
};
