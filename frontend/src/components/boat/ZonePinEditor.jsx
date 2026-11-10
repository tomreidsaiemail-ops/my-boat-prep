import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { PinnedPhoto, pinName } from "@/components/boat/PinnedPhoto";
import { ZONE_COLOURS, areaZones } from "@/lib/zoneColours";

const NEW = "__new";
const STEP = 0.01;
const pinId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const NUDGES = [["up", ArrowUp, 0, -STEP], ["left", ArrowLeft, -STEP, 0], ["down", ArrowDown, 0, STEP], ["right", ArrowRight, STEP, 0]];

const Nudge = ({ onNudge }) => (
  <div className="flex flex-wrap items-center gap-1.5" data-testid="zone-pin-nudge">
    <span className="field-label mr-1">Move label</span>
    {NUDGES.map(([dir, Icon, dx, dy]) => (
      <button key={dir} type="button" className="btn-ghost h-10 w-10 justify-center p-0" aria-label={`Move label ${dir}`} onClick={() => onNudge(dx, dy)} data-testid={`zone-pin-nudge-${dir}`}>
        <Icon className="h-4 w-4" />
      </button>
    ))}
  </div>
);

const PinForm = ({ pin, areas, zoneName, onSave, onDelete, onCancel, onNudge }) => {
  const linked = areas.some((a) => a.id === pin.area_id);
  const [areaId, setAreaId] = useState(linked ? pin.area_id : pin.label ? NEW : areas.find((a) => !a.parent_id)?.id || NEW);
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
      <label className="flex flex-col gap-1"><span className="field-label">Cupboard at this spot{zoneName ? ` (${zoneName} cupboards)` : ""}</span>
        <select value={areaId} onChange={(e) => { setAreaId(e.target.value); setError(""); }} className="field-input" data-testid="zone-pin-area-select">
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value={NEW}>New cupboard...</option>
        </select>
      </label>
      {zoneName && !areas.length && areaId !== NEW && <p className="text-xs text-[var(--muted)]" data-testid="zone-pin-none-in-zone">No cupboards in {zoneName} yet.</p>}
      {areaId === NEW && <input autoFocus value={name} maxLength={60} placeholder="e.g. Port Lazarette" onChange={(e) => { setName(e.target.value); setError(""); }}
        className="field-input" aria-label="New cupboard name" data-testid="zone-pin-name-input" />}
      {areaId === NEW && <p className="text-xs text-[var(--muted)]">A new name is also added to your Boat Inventory when you save.</p>}
      {error && <p className="text-sm font-bold text-[var(--red)]" data-testid="zone-pin-error">{error}</p>}
      <Nudge onNudge={onNudge} />
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
  const [comment, setComment] = useState("");
  useEffect(() => { setPins(pic?.map.pins || []); setComment(pic?.map.comment || ""); setEditing(null); }, [pic]);
  if (!pic) return null;
  // Only the cupboards in this map's zone (plus the one a label already points at); a map with no colour offers them all.
  const zone = ZONE_COLOURS[pic.map.colour] ? pic.map.colour : "";
  const zones = areaZones(boat, areas);
  const choicesFor = (pin) => areas.filter((a) => !a.parent_id && (!zone || zones[a.id]?.colour === zone || a.id === pin.area_id));
  const place = (e) => {
    const r = img.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setEditing({ pin: { id: pinId(), x, y, label: "", area_id: null }, isNew: true });
  };
  const keep = (p) => { setPins((ps) => (editing.isNew ? [...ps, p] : ps.map((x) => (x.id === p.id ? p : x)))); setEditing(null); };
  const movePin = (id, x, y) => {
    const at = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    setPins((ps) => ps.map((p) => (p.id === id ? { ...p, ...at } : p)));
    setEditing((ed) => (ed && ed.pin.id === id ? { ...ed, pin: { ...ed.pin, ...at } } : ed));
  };
  const shown = editing?.isNew ? [...pins, editing.pin] : pins;
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
      onMaps((await api.put(`/boats/${boat.boat_id}/zone-maps/${pic.map.id}/pins`, { pins: linked, comment: comment.trim() })).data.zone_maps);
      toast.success(`${linked.length} ${linked.length === 1 ? "label" : "labels"} saved on this zone map`);
      onClose();
    } catch (e) { toast.error(apiError(e, "Couldn't save the labels")); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-3" data-testid="zone-pin-editor">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-extrabold uppercase tracking-tight">Label this zone map</DialogTitle>
          <DialogDescription>Tap the photo where a cupboard, lazarette, drawer or fridge is, then pick its cupboard. Drag a label to move it, or tap it to fine-tune with the arrows, change or remove it.</DialogDescription>
        </DialogHeader>
        <PinnedPhoto src={pic.src} alt="Zone map to label" pins={shown} areas={areas} imgRef={img} onImage={editing ? undefined : place}
          onPin={(p) => { if (!editing?.isNew) setEditing({ pin: p, isNew: false }); }} onDrag={(p, x, y) => movePin(p.id, x, y)}
          highlight={editing?.pin.id} imgClass="max-h-[60vh] w-full rounded-md object-contain" testId="zone-pin-photo" />
        {editing && <PinForm key={editing.pin.id} pin={editing.pin} areas={choicesFor(editing.pin)} zoneName={zone ? pic.map.zone || pic.map.name || zone : ""} onSave={keep} onCancel={() => setEditing(null)}
          onNudge={(dx, dy) => movePin(editing.pin.id, editing.pin.x + dx, editing.pin.y + dy)}
          onDelete={editing.isNew ? null : () => { setPins((ps) => ps.filter((x) => x.id !== editing.pin.id)); setEditing(null); }} />}
        {!editing && <p className="text-xs text-[var(--muted)]" data-testid="zone-pin-count">{pins.length ? `${pins.length} ${pins.length === 1 ? "label" : "labels"}: ${pins.map((p) => pinName(p, areas)).join(", ")}` : "No labels yet. Tap the photo to add one."}</p>}
        <label className="flex flex-col gap-1" htmlFor="zone-map-comment">
          <span className="field-label">Skipper&apos;s comment</span>
          <textarea id="zone-map-comment" value={comment} maxLength={500} rows={2} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Above the Nav Desk is the switch board"
            className="field-input min-h-[64px] py-2" data-testid="zone-map-comment-input" />
          <span className="text-xs text-[var(--muted)]">Shown under this photo for every cupboard on it, including in the Crew walkthrough.</span>
        </label>
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
