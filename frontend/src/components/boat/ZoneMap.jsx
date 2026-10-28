import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Footprints, ImagePlus, Loader2, Map, MapPin, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, API, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";
import { HelpPanel } from "@/components/boat/HelpPanel";
import { PinnedPhoto } from "@/components/boat/PinnedPhoto";
import { ZonePinEditor } from "@/components/boat/ZonePinEditor";
import { CrewWalkthrough, walkSteps } from "@/components/boat/CrewWalkthrough";

const mapUrl = (v) => `${API}/inventory/zone-map?v=${encodeURIComponent(v)}`;
const MAX_MAPS = 20;
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

export const ZoneMap = ({ version, admin, online, onChanged, boat, canEdit, onBoatMaps, areas = [], onOpenArea, onAddAreas, focusPin, onSignOff }) => {
  const [open, setOpen] = useState(null);
  const [labelling, setLabelling] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [foodOnly, setFoodOnly] = useState(false);
  const foodIds = new Set(areas.filter((a) => a.food).map((a) => a.id));
  const hasFoodPins = (boat?.zone_maps || []).some((m) => (m.pins || []).some((p) => foodIds.has(p.area_id)));
  const pinsFor = (pins) => (foodOnly ? (pins || []).filter((p) => foodIds.has(p.area_id)) : pins);
  const [walking, setWalking] = useState(false);
  useEffect(() => {
    const m = focusPin && (boat?.zone_maps || []).find((z) => z.id === focusPin.mapId && !failed[z.id]);
    if (!m) return;
    setExpanded(true);
    setOpen({ key: m.id, src: boatMapUrl(boat, m), map: m, highlight: focusPin.pinId });
  }, [focusPin]); // eslint-disable-line react-hooks/exhaustive-deps
  const tapPin = (pin) => {
    if (pin.area_id && areas.some((a) => a.id === pin.area_id)) onOpenArea?.(pin.area_id);
    else toast.message(`${pin.label} isn't listed in Boat Inventory yet`);
  };
  const [failed, setFailed] = useState({});
  const [removing, setRemoving] = useState(null);
  const own = (boat?.zone_maps || []).filter((m) => !failed[m.id]);
  const pics = own.length ? own.map((m) => ({ key: m.id, src: boatMapUrl(boat, m), map: m }))
    : version && !failed.admin ? [{ key: "admin", src: mapUrl(version) }] : [];
  const steps = walkSteps(pics.filter((p) => p.map));
  if (!pics.length && !admin && !canEdit) return null;
  const removeMap = async (m) => {
    if (!online) { toast.error("You need a signal to remove a zone map"); return; }
    setRemoving(m.id);
    try { onBoatMaps((await api.delete(`/boats/${boat.boat_id}/zone-maps/${m.id}`)).data.zone_maps); toast.success("Zone map removed"); }
    catch (e) { toast.error(apiError(e, "Couldn't remove the zone map")); } finally { setRemoving(null); }
  };
  return (
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="zone-map">
      <button type="button" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded} className="flex items-center gap-2 text-left text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid="zone-map-toggle">
        <Map className="h-4 w-4" /> {own.length > 1 ? `Zone maps (${own.length})` : "Zone map"}
        <ChevronDown className={`ml-auto h-5 w-5 [transition:transform_.15s] ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <>
      {canEdit && (
        <HelpPanel storageKey="mbp_zone_map_help_seen" title="How to make a zone map" testId="zone-map-help">
          <p>Take high level photos of your boat, and annotate the boat areas onto these photos. You can ask google how to do that for your device. This way crew members without being too boat savvy, will know where the Cockpit - Port Lazarette is. Another good approach is to annotate the high level photo and more take detailed photos of say your cabin or flybridge where cupboards or shelves may exist.</p>
        </HelpPanel>
      )}
      {steps.length > 0 && (
        <button type="button" className="btn-solid h-10 justify-center gap-2 text-sm" onClick={() => setWalking(true)} data-testid="crew-walkthrough-btn">
          <Footprints className="h-4 w-4" /> Crew walkthrough ({steps.length} {steps.length === 1 ? "stop" : "stops"})
        </button>
      )}
      {hasFoodPins && (
        <button type="button" className={`flex h-10 items-center justify-center gap-2 rounded-md border-[1.5px] text-sm font-bold ${foodOnly ? "border-emerald-700 bg-emerald-700 text-white" : "border-[var(--line)]"}`}
          onClick={() => setFoodOnly((f) => !f)} aria-pressed={foodOnly} data-testid="zone-map-food-filter">
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] text-[11px] font-extrabold ${foodOnly ? "border-white" : "border-emerald-700 text-emerald-800"}`}>F</span>
          {foodOnly ? "Showing Food areas only" : "Show Food areas only"}
        </button>
      )}
      {pics.filter((p) => !foodOnly || pinsFor(p.map?.pins).length).map((p, n) => (
        <div key={p.key} className="flex flex-col gap-1" data-testid={`zone-map-item-${p.key}`}>
          <PinnedPhoto src={p.src} alt={`Boat zone map ${n + 1}`} pins={pinsFor(p.map?.pins)} areas={areas} onPin={tapPin} onImage={() => setOpen(p)}
            onError={() => setFailed((f) => ({ ...f, [p.key]: true }))} testId={p.key === "admin" ? "zone-map-default" : `boat-zone-map-${p.key}`} />
          {p.map && canEdit && (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-3 text-xs" onClick={() => (online ? setLabelling(p) : toast.error("You need a signal to label a zone map"))} data-testid={`boat-zone-map-label-${p.key}`}>
                <MapPin className="h-3.5 w-3.5" /> {p.map.pins?.length ? `Edit labels (${p.map.pins.length})` : "Label this map"}
              </button>
              <button type="button" className="btn-ghost h-9 px-3 text-xs hover:text-[var(--red)]" disabled={removing === p.key} onClick={() => removeMap(p.map)} data-testid={`boat-zone-map-remove-${p.key}`}>
                {removing === p.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove this map
              </button>
            </div>
          )}
        </div>
      ))}
      {!pics.length && <p className="text-sm text-[var(--muted)]" data-testid="zone-map-empty">No zone map yet. Upload a layout picture showing your cupboards and lockers.</p>}
      {own.length === 0 && pics.length > 0 && canEdit && <p className="text-xs text-[var(--muted)]" data-testid="zone-map-default-note">This is the default map to give you an idea. Upload photos of your own boat and annotate the photos with boat areas, so annotate cupboards, lazarettes, drawers, shelves, fridges etc's so a new crew member knows that boat area. You can do that after taking the boat inventory. You can rename boat areas later should the zone map photo have a better name.</p>}
      {canEdit && <OwnerTools boat={boat} count={own.length} online={online} onMaps={onBoatMaps} />}
      {admin && (
        <div className="flex flex-col gap-1 border-t border-[var(--line)] pt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Default map for skippers without their own</p>
          <AdminTools has={!!version} online={online} onChanged={onChanged} />
        </div>
      )}
      </>}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl rounded-lg border-2 border-[var(--navy)] p-2" data-testid="zone-map-dialog" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Zone map</DialogTitle>
          {open && <PinnedPhoto src={open.src} alt="Boat zone map" pins={pinsFor(open.map?.pins)} areas={areas} onPin={(pin) => { setOpen(null); tapPin(pin); }} highlight={open.highlight}
            imgClass="max-h-[80vh] w-full object-contain" testId="zone-map-full" />}
        </DialogContent>
      </Dialog>
      {walking && <CrewWalkthrough steps={steps} areas={areas} onClose={() => setWalking(false)} onOpenArea={(id) => onOpenArea?.(id)} onSignOff={onSignOff} />}
      {labelling && <ZonePinEditor pic={labelling} boat={boat} areas={areas} online={online} onAddAreas={onAddAreas} onMaps={onBoatMaps} onClose={() => setLabelling(null)} />}
    </section>
  );
};
