import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { PinnedPhoto, pinName } from "@/components/boat/PinnedPhoto";

const NEW = "__new";
const pinId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const PinForm = ({ pin, areas, onSave, onDelete, onCancel }) => {
  const linked = areas.some((a) => a.id === pin.area_id);
  const [areaId, setAreaId] = useState(linked ? pin.area_id : pin.label ? NEW : areas[0]?.id || NEW);
  const [name, setName] = useState(linked ? "" : pin.label || "");
  const [error, setError] = useState("");
  const save = () => {
    const area = areas.find((a) => a.id === areaId);
    if (area) return onSave({ ...pin, area_id: area.id, label: area.name });
    if (!name.trim()) { setError("Type a name for this spot"); return; }
    onSave({ ...pin, area_id: null, label: name.trim().slice(0, 60) });
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border-[1.5px] border-[var(--navy)] bg-[var(--panel)] p-3" data-testid="zone-pin-form">
      <label className="flex flex-col gap-1"><span className="field-label">Boat area at this spot</span>
        <select value={areaId} onChange={(e) => { setAreaId(e.target.value); setError(""); }} className="field-input" data-testid="zone-pin-area-select">
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value={NEW}>New boat area...</option>
        </select>
      </label>
      {areaId === NEW && <input autoFocus value={name} maxLength={60} placeholder="e.g. Port Lazarette" onChange={(e) => { setName(e.target.value); setError(""); }}
        className="field-input" aria-label="New boat area name" data-testid="zone-pin-name-input" />}
      {areaId === NEW && <p className="text-xs text-[var(--muted)]">A new name is also added to your Boat Inventory when you save.</p>}
      {error && <p className="text-sm font-bold text-[var(--red)]" data-testid="zone-pin-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-solid h-10 px-4 text-sm" onClick={save} data-testid="zone-pin-save-btn">Place label</button>
        <button type="button" className="btn-ghost h-10 px-3 text-sm" onClick={onCancel} data-testid="zone-pin-cancel-btn">Cancel</button>
        {onDelete && <button type="button" className="btn-ghost ml-auto h-10 px-3 text-sm hover:text-[var(--red)]" onClick={onDelete} data-testid="zone-pin-delete-btn"><Trash2 className="h-4 w-4" /> Remove label</button>}
      </div>
    </div>
  );
};

export const ZonePinEditor = ({ pic, boat, areas, online, onAddAreas, onMaps, onClose }) => {
  const img = useRef(null);
  const [pins, setPins] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPins(pic?.map.pins || []); setEditing(null); }, [pic]);
  if (!pic) return null;
  const place = (e) => {
    const r = img.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setEditing({ pin: { id: pinId(), x, y, label: "", area_id: null }, isNew: true });
  };
  const keep = (p) => { setPins((ps) => (editing.isNew ? [...ps, p] : ps.map((x) => (x.id === p.id ? p : x)))); setEditing(null); };
  const save = async () => {
    if (!online) { toast.error("You need a signal to save zone map labels"); return; }
    const fresh = [...new Set(pins.filter((p) => !areas.some((a) => a.id === p.area_id)).map((p) => p.label))].filter((n) => !areas.some((a) => a.name.trim().toLowerCase() === n.toLowerCase()));
    const ids = fresh.length ? onAddAreas(fresh) : {};
    const linked = pins.map((p) => {
      const area = areas.find((a) => a.id === p.area_id) || areas.find((a) => a.name.trim().toLowerCase() === p.label.toLowerCase());
      if (area) return { ...p, area_id: area.id, label: area.name.slice(0, 60) };
      return { ...p, area_id: ids[p.label] || null };
    });
    setBusy(true);
    try {
      onMaps((await api.put(`/boats/${boat.boat_id}/zone-maps/${pic.map.id}/pins`, { pins: linked })).data.zone_maps);
      toast.success(`${linked.length} ${linked.length === 1 ? "label" : "labels"} saved on this zone map`);
      onClose();
    } catch (e) { toast.error(apiError(e, "Couldn't save the labels")); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-3" data-testid="zone-pin-editor">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-extrabold uppercase tracking-tight">Label this zone map</DialogTitle>
          <DialogDescription>Tap the photo where a cupboard, lazarette, drawer or fridge is, then pick its boat area. Tap a label to change or remove it.</DialogDescription>
        </DialogHeader>
        <PinnedPhoto src={pic.src} alt="Zone map to label" pins={pins} areas={areas} imgRef={img} onImage={editing ? undefined : place}
          onPin={(p) => setEditing({ pin: p, isNew: false })} imgClass="max-h-[60vh] w-full rounded-md object-contain" testId="zone-pin-photo" />
        {editing && <PinForm key={editing.pin.id} pin={editing.pin} areas={areas} onSave={keep} onCancel={() => setEditing(null)}
          onDelete={editing.isNew ? null : () => { setPins((ps) => ps.filter((x) => x.id !== editing.pin.id)); setEditing(null); }} />}
        {!editing && <p className="text-xs text-[var(--muted)]" data-testid="zone-pin-count">{pins.length ? `${pins.length} ${pins.length === 1 ? "label" : "labels"}: ${pins.map((p) => pinName(p, areas)).join(", ")}` : "No labels yet. Tap the photo to add one."}</p>}
        <DialogFooter className="gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} data-testid="zone-pin-editor-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid" disabled={busy || !!editing} onClick={save} data-testid="zone-pin-editor-save-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save labels
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
