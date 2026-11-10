import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Focus, HelpCircle, Layers, Lightbulb, Plus, Search, UploadCloud, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { ZoneMap } from "@/components/boat/ZoneMap";
import { InventoryArea } from "@/components/boat/InventoryArea";
import { matches } from "@/components/boat/Highlight";
import { ScanReviewDialog } from "@/components/boat/ScanReviewDialog";
import { BatchScanDialog } from "@/components/boat/BatchScanDialog";
import { shrink } from "@/components/boat/PhotoPicker";
import { InventoryItemDialog } from "@/components/boat/InventoryItemDialog";
import { SuggestAreasDialog } from "@/components/boat/SuggestAreasDialog";
import { TextDialog } from "@/components/boat/TextDialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { MoveAreaDialog } from "@/components/boat/MoveAreaDialog";
import { newAreaItemId } from "@/lib/inventoryMove";
import { zoneDefaultAreas } from "@/lib/zoneDefaults";
import { areaZones, boatZones, rainbowGroups } from "@/lib/zoneColours";
import { ZoneDialog } from "@/components/boat/zone/ZoneDialog";
import { ZonePicker } from "@/components/boat/zone/ZonePicker";
import { AreaZoneButton } from "@/components/boat/zone/AreaZoneButton";
import { BatchZonePrompt } from "@/components/boat/zone/BatchZonePrompt";
import { SubAreaTools } from "@/components/boat/inventory/SubAreaTools";
import { MergeAreaDialog } from "@/components/boat/inventory/MergeAreaDialog";
import { FolderCardsButton } from "@/components/boat/inventory/FolderCardsButton";
import { QrScanDialog } from "@/components/boat/inventory/QrScanDialog";
import { clearQr, pendingQr, qrBoatKey } from "@/lib/qrScan";
import { applyQr } from "@/lib/qrStock";
import { useAuth } from "@/context/AuthContext";
import useAdminLists from "@/hooks/useAdminLists";
import { LinkedText } from "@/components/boat/LinkedText";
import { AreaEditDialog } from "@/components/boat/inventory/AreaEditDialog";

const newId = newAreaItemId;
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const INSTR_KEY = "mbp_inventory_instructions_collapsed";

const HELP_NAME = "admin - help panel - how to take your boat inventory";
const DEFAULT_HELP = [
  "Make sure and get the zone schematic for yacht, if you have not done that, then expand the Boat drop down, and click \"Additional boat details...\", fill in boat type, make, model and year of manufacture.",
  "Click on ZONE MAP OVERVIEWS, these are schematics of your boat.",
  "This will take you a feature \"Magically Create Colours\", this looks at your boats schematic and tries to place Galley Orange onto your Galley schematic, along with anything else it can figure out. Best to get a schematic where the Galley, Saloon etc are labelled.",
  "From here on just pick a colour like Orange and Batch Magic Scan your Galley cupboards. The sailing community have provided great defaults for your Galley cupboards like Dry Storage Locker, but you can add your own.",
].map((label) => ({ label }));

const InventoryInstructions = ({ searching, online }) => {
  const [open, setOpenState] = useState(() => localStorage.getItem(INSTR_KEY) !== "1");
  const setOpen = (v) => { setOpenState(v); localStorage.setItem(INSTR_KEY, v ? "0" : "1"); };
  useEffect(() => { if (searching) setOpen(false); }, [searching]); // eslint-disable-line react-hooks/exhaustive-deps
  const admin = useAdminLists("Admin - Help Panel - ", online).find((l) => l.name.toLowerCase().replace(/\s+/g, " ").trim() === HELP_NAME)?.items;
  const lines = admin?.length ? admin : DEFAULT_HELP;
  return (
    <div className="rounded-lg border-[1.5px] border-dashed border-[var(--line)] bg-white text-sm text-[var(--muted)]" data-testid="inventory-instructions">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left font-bold text-[var(--navy)]" data-testid="inventory-instructions-toggle">
        <HelpCircle className="h-4 w-4 shrink-0" /> How to take your Boat Inventory
        <ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4" data-testid="inventory-instructions-body">
          {lines.map((i, k) => (
            <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : ""} data-testid={`inventory-instructions-line-${k}`}>
              <LinkedText text={i.label} testId={`inventory-instructions-link-${k}`} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const ADD_TIP_KEY = "mbp_add_area_tip";
const AddArea = ({ onAdd, onBatch, placeholder = "Add a cupboard, a box or a folder" }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [tip, setTip] = useState(() => localStorage.getItem(ADD_TIP_KEY) === "1");
  const showTip = () => { if (!tip) { localStorage.setItem(ADD_TIP_KEY, "1"); setTip(true); } };
  const submit = (e) => {
    e.preventDefault();
    const res = onAdd(name.trim());
    if (typeof res === "string") { setError(res); return; }
    setName(""); setError("");
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-1" data-testid="inventory-add-area-form">
      {tip && <p className="text-xs font-semibold text-[var(--navy)]" data-testid="inventory-add-area-tip">Boxes and folders can easily be moved into a cupboard!</p>}
      <div className="flex gap-1.5 sm:gap-2">
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onFocus={showTip} placeholder={placeholder}
          aria-label="Cupboard, box or folder name" className="field-input h-12 min-w-0 flex-1 !px-3 placeholder:text-[12.5px]" data-testid="inventory-add-area-input" />
        <button type="submit" className="btn-solid h-12 w-11 shrink-0 sm:w-12 justify-center p-0" aria-label="Add cupboard" data-testid="inventory-add-area-btn"><Plus className="h-5 w-5" /></button>
        {onBatch && <button type="button" onClick={onBatch} className="btn-solid h-12 w-12 shrink-0 sm:w-14 justify-center gap-0 p-0" aria-label="Batch Magic Scan: add several cupboards with photos" title="Batch Magic Scan"
          data-testid="inventory-batch-scan-btn"><Plus className="-mr-1.5 h-5 w-5" /><Plus className="h-5 w-5" /></button>}
      </div>
      {error && <p className="text-sm font-semibold text-[var(--red)]" data-testid="inventory-add-area-error">{error}</p>}
    </form>
  );
};

export const InventoryList = ({ areas, onChange, readOnly, crewFood = false, admin, online, shared, onSharedChange, boat, details, onBoatMaps, linked = {}, onToggleLinked, onMoveItems, batchRequest, onBatchHandled, batchHelp, onSyncStores, onSignOff, vessel = "", loaded = true }) => {
  const [dialog, setDialog] = useState(null);
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(null);
  const [scan, setScan] = useState(null);
  const [fresh, setFresh] = useState(null);
  const startScan = (a) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!online) { toast.error("AI Auto-Scan needs a signal"); return; }
    let blob;
    try { blob = await shrink(file, 1600); } catch { toast.error("That file doesn't look like a photo"); return; }
    const form = new FormData();
    form.append("file", blob, "cupboard.jpg");
    setScanning(a.id);
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/scan`, form, { timeout: 90000 });
      setScan({ area: a, items: data.items });
      if (data.scans_left <= 3) toast.message(`${data.scans_left} Magic generations left`);
    } catch (err) { toast.error(apiError(err, "The AI scan didn't work, please try again")); } finally { setScanning(null); }
  };
  const saveScan = (list, mode) => {
    const { area } = scan;
    setArea(area.id, (x) => ({ ...x, items: applyQr(x.items || [], list, mode === "add" ? "add" : "replace") }));
    setScan(null);
    toast.success(mode === "add" ? `${list.length} ${list.length === 1 ? "item" : "items"} added to ${area.name}` : `${area.name} now lists ${list.length} ${list.length === 1 ? "item" : "items"}`);
  };
  const q = query.trim().toLowerCase();
  const isTop = (a) => !a.parent_id || !areas.some((p) => p.id === a.parent_id);
  const tops = areas.filter(isTop);
  const subsOf = (id) => areas.filter((a) => a.parent_id === id && a.id !== id);
  const zones = areaZones(boat, areas);
  const hit = (a, all) => {
    const links = linked[a.id] || [];
    if (!q || all || matches(a.name, q)) return { area: a, visible: a.items || [], visibleLinked: links };
    const hits = (a.items || []).filter((i) => matches(i.name, q));
    const linkHits = links.filter((l) => matches(`${l.listName} ${l.text}`, q));
    return hits.length || linkHits.length ? { area: a, visible: hits, visibleLinked: linkHits } : null;
  };
  // Search looks inside folders and boxes too, so a hit shows its zone map, cupboard and sub-area.
  const results = tops.flatMap((a) => {
    const own = hit(a);
    const subs = subsOf(a.id).map((s) => hit(s, !!q && matches(a.name, q))).filter(Boolean);
    if (!own && !subs.length) return [];
    return [{ ...(own || { area: a, visible: [], visibleLinked: [] }), subs }];
  });
  const rows = results.flatMap((r) => [r, ...r.subs]);
  const found = rows.reduce((n, r) => n + (r.visible || []).reduce((m, i) => m + (i.qty || 1), 0) + (r.visibleLinked || []).length, 0);
  const out = rows.reduce((n, r) => n + (r.visible || []).filter((i) => i.removed).length, 0);
  const suggestions = shared.area_defaults.filter((n) => !areas.some((a) => same(a.name, n)));
  const setArea = (id, fn) => onChange((list) => list.map((a) => (a.id === id ? fn(a) : a)));
  const moveItem = (area, item, edits, targetId) => {
    const dest = areas.find((a) => a.id === targetId);
    const match = (dest.items || []).find((i) => same(i.name, edits.name));
    if (match && match.qty + edits.qty > 9999) return `That would put more than 9999 ${edits.name} in ${dest.name}`;
    const moved = { ...item, ...edits };
    onChange((list) => list.map((a) => {
      if (a.id === area.id) return { ...a, items: a.items.filter((i) => i.id !== item.id) };
      if (a.id !== targetId) return a;
      if (!match) return { ...a, items: [...(a.items || []), moved] };
      return { ...a, items: a.items.map((i) => (i.id === match.id ? { ...i, qty: i.qty + edits.qty, removed: !!(i.removed || item.removed) } : i)) };
    }));
    setDialog(null);
    toast.success(`Moved ${edits.name} to ${dest.name}`);
  };
  const undoToast = (name, undo) => toast(`Deleted "${name.length > 40 ? `${name.slice(0, 40)}…` : name}"`, { duration: 6000, action: { label: "Undo", onClick: undo } });
  const deleteItem = (area, item) => {
    const index = area.items.findIndex((y) => y.id === item.id);
    setArea(area.id, (x) => ({ ...x, items: x.items.filter((y) => y.id !== item.id) }));
    undoToast(item.name, () => setArea(area.id, (x) => {
      if (x.items.some((y) => y.id === item.id)) return x;
      const items = [...x.items];
      items.splice(Math.min(index, items.length), 0, item);
      return { ...x, items };
    }));
  };
  // Checklist tags point at the area id, so restoring the same area brings its tagged items back too. Its folders and boxes go with it.
  const deleteArea = (area) => {
    const before = areas;
    const gone = new Set([area.id, ...subsOf(area.id).map((s) => s.id)]);
    onChange((list) => list.filter((a) => !gone.has(a.id)));
    undoToast(area.name, () => onChange((list) => {
      if (list.some((a) => a.id === area.id)) return list;
      const kept = before.filter((a) => gone.has(a.id) || list.some((x) => x.id === a.id)).map((a) => list.find((x) => x.id === a.id) || a);
      return [...kept, ...list.filter((x) => !before.some((b) => b.id === x.id))];
    }));
  };
  const addSub = (name) => {
    const parent = dialog.area;
    if (!name) return "Please enter a name, e.g. Red folder";
    if (subsOf(parent.id).some((s) => same(s.name, name))) return `${name} is already in ${parent.name}`;
    onChange((list) => [...list, { id: newId(), name, items: [], parent_id: parent.id }]);
    setDialog(null);
    toast.success(`${name} added to ${parent.name}. Open it to Magic Scan its contents.`);
    return true;
  };
  const mergeInto = (targetId) => {
    const { area } = dialog;
    const target = areas.find((a) => a.id === targetId);
    if (subsOf(targetId).some((s) => same(s.name, area.name))) { toast.error(`${target.name} already has ${area.name}`); return; }
    setArea(area.id, (a) => ({ ...a, parent_id: targetId }));
    setDialog(null);
    toast.success(`${area.name} is now inside ${target.name}`);
  };
  const takeOut = (sub) => {
    const parent = areas.find((a) => a.id === sub.parent_id);
    if (tops.some((t) => same(t.name, sub.name))) { toast.error(`There's already a cupboard called ${sub.name}. Rename it first.`); return; }
    setArea(sub.id, ({ parent_id: _p, ...a }) => a);
    toast.success(`${sub.name} taken out of ${parent?.name || "its cupboard"}`);
  };
  const startMove = (a) => {
    if (areas.length < 2) { toast.warning("You can only move items to new cupboards when there is more than one cupboard."); return; }
    if (!(a.items || []).length && !(linked[a.id] || []).length) { toast.message(`${a.name} has nothing to move yet`); return; }
    setDialog({ type: "move", area: a });
  };
  const finishMove = (plan, count) => {
    const { area } = dialog;
    if (onMoveItems(plan) === false) return;
    setDialog(null);
    toast.success(`Moved ${count} ${count === 1 ? "item" : "items"} from ${area.name}`);
  };

  const addArea = (name, extra = {}) => {
    if (!name) return "Please enter a cupboard or locker name";
    if (tops.some((a) => same(a.name, name))) return `${name} is already on your list`;
    const id = newId();
    setFresh(id);
    onChange((list) => [...list, { id, name, items: [], ...extra }]);
    return true;
  };
  // Crew can change Food (F) and Drink (D) cupboards, and the folders and boxes inside them.
  const fdTop = new Set(tops.filter((a) => a.food || a.drinks).map((a) => a.id));
  const crewCan = (a) => crewFood && (fdTop.has(a.id) || fdTop.has(a.parent_id));
  const locked = (a) => readOnly && !crewCan(a);
  const flag = (a, key, on, off) => () => {
    const next = { ...a, [key]: !a[key] };
    if (readOnly && !next.food && !next.drinks) { toast.error(`${a.name} must stay a Food or Drinks area. Ask the skipper to change it.`); return; }
    setArea(a.id, (x) => ({ ...x, [key]: !x[key] }));
    toast.success(a[key] ? off : on);
  };
  const addSuggested = (names) => onChange((list) => [...list, ...names.map((name) => ({ id: newId(), name, items: [] }))]);
  const addAreasNamed = (names) => {
    const ids = Object.fromEntries(names.map((n) => [n, newId()]));
    onChange((list) => [...list, ...names.filter((n) => !list.some((a) => same(a.name, n))).map((name) => ({ id: ids[name], name, items: [] }))]);
    return ids;
  };
  // Magically Place Colours found these zones: give each its usual cupboards (Galley: Fridge, Pantry...), never doubling one up.
  const addZoneDefaults = (swatches) => {
    const fresh = zoneDefaultAreas(swatches, areas);
    if (fresh.length) onChange((list) => [...list, ...zoneDefaultAreas(swatches, list)]);
    return fresh.length;
  };
  const [focus, setFocus] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const pinFor = {};
  (boat?.zone_maps || []).forEach((m) => (m.pins || []).forEach((p) => { if (p.area_id && !pinFor[p.area_id]) pinFor[p.area_id] = { mapId: m.id, pinId: p.id }; }));
  const openArea = (id) => {
    setQuery("");
    setFocus({ id, at: Date.now() });
    setTimeout(() => document.querySelector(`[data-testid="inventory-area-${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const [batchOpen, setBatchOpen] = useState(false);
  const [zone, setZone] = useState(null);
  const [batchZone, setBatchZone] = useState(null);
  const [zonePrompt, setZonePrompt] = useState(false);
  const boatZoneList = boat && !boat.owner_id && !readOnly ? boatZones(boat) : [];
  const pickZones = boat ? boatZones(boat) : [];
  const zoneCounts = {};
  tops.forEach((a) => { const z = zones[a.id]; if (z) zoneCounts[z.colour] = (zoneCounts[z.colour] || 0) + 1; });
  useEffect(() => {
    if (!batchRequest) return;
    onBatchHandled();
    if (!boat || boat.owner_id || readOnly) return;
    if (!boatZoneList.length) { setBatchOpen(true); return; }
    const z = batchRequest.zone && boatZoneList.find((x) => x.label === batchRequest.zone.label);
    if (z) scanZone(z); else setZonePrompt(true);
  }, [batchRequest]); // eslint-disable-line react-hooks/exhaustive-deps
  const openBatch = () => (online ? setBatchOpen(true) : toast.error("Batch Magic Scan needs a signal"));
  const scanZone = (z) => {
    if (!online) { toast.error("Batch Magic Scan needs a signal"); return; }
    setZone(null); setBatchZone(z); setBatchOpen(true);
  };
  const closeBatch = () => { setBatchOpen(false); setBatchZone(null); };
  const { user } = useAuth();
  const [qrArea, setQrArea] = useState(null);
  useEffect(() => {
    const qr = pendingQr();
    if (!loaded || !qr || !boat || qrBoatKey(qr, user.user_id) !== boat.key) return;
    const a = areas.find((x) => String(x.id) === qr.area);
    clearQr();
    if (!a) { toast.error("That QR card's cupboard isn't on this boat any more"); return; }
    if (locked(a)) { toast.error(`Only the skipper can change ${a.name}`); return; }
    setQrArea(a);
    openArea(a.parent_id || a.id);
  }, [boat?.key, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveQr = (list, mode) => setArea(qrArea.id, (x) => ({ ...x, items: applyQr(x.items, list, mode) }));
  const [folds, setFolds] = useState(() => { try { return JSON.parse(localStorage.getItem(`mbp_zone_folds_${boat?.key}`)) || []; } catch { return []; } });
  const setFoldList = (next) => { localStorage.setItem(`mbp_zone_folds_${boat?.key}`, JSON.stringify(next)); setFolds(next); };
  const toggleFold = (k) => setFoldList(folds.includes(k) ? folds.filter((x) => x !== k) : [...folds, k]);
  const applyBatch = (list) => {
    const toItems = (items) => items.map((i) => ({ id: newId(), name: i.name, qty: i.qty }));
    const tag = batchZone ? { zone: { label: batchZone.label, colour: batchZone.colour } } : {};
    onChange((cur) => {
      const next = [...cur];
      list.forEach(({ name, items, mode, where }) => {
        const at = next.findIndex((a) => !a.parent_id && same(a.name, name));
        const place = where ? { where } : {};
        if (at >= 0) next[at] = { ...next[at], ...tag, ...place, items: mode === "add" ? applyQr(next[at].items || [], items, "add") : toItems(items) };
        else next.push({ id: newId(), name, ...tag, ...place, items: toItems(items) });
      });
      return next;
    });
    closeBatch();
    const count = list.reduce((n, a) => n + a.items.length, 0);
    const old = list.filter((a) => tops.some((x) => same(x.name, a.name)));
    const merged = old.filter((a) => a.mode === "add").length;
    const replaced = old.length - merged;
    const added = list.length - old.length;
    const parts = [added && `${added} boat ${added === 1 ? "area" : "areas"} added`, merged && `${merged} added to`, replaced && `${replaced} replaced`].filter(Boolean).join(", ");
    toast.success(`${parts} with ${count} ${count === 1 ? "item" : "items"}`);
  };
  const renameArea = (name, where, comment) => {
    const { area } = dialog;
    if (!name) return "Please enter a name";
    const scope = area.parent_id ? subsOf(area.parent_id) : tops;
    if (scope.some((a) => a.id !== area.id && same(a.name, name))) return `${name} is already on your list`;
    setArea(area.id, ({ where: _w, comment: _c, ...a }) => ({ ...a, name, ...(where ? { where } : {}), ...(comment ? { comment } : {}) }));
    setDialog(null);
    return true;
  };
  const addItem = (area) => ({ name, qty }) => {
    if ((area.items || []).some((i) => same(i.name, name))) return `${name} is already in ${area.name}`;
    setArea(area.id, (a) => ({ ...a, items: [...(a.items || []), { id: newId(), name, qty }] }));
    return true;
  };
  const saveItem = ({ name, qty, target }) => {
    const { area, item } = dialog;
    if (target && target !== area.id) return moveItem(area, item, { name, qty }, target);
    if (area.items.some((i) => i.id !== item.id && same(i.name, name))) return `${name} is already in ${area.name}`;
    setArea(area.id, (a) => ({ ...a, items: a.items.map((i) => (i.id === item.id ? { ...i, name, qty } : i)) }));
    setDialog(null);
    return true;
  };
  const publish = async () => {
    if (!online) { toast.error("You need a signal to publish suggestions"); return; }
    try {
      const { data } = await api.put("/admin/inventory/area-defaults", { names: areas.map((a) => a.name) }, { timeout: 10000 });
      onSharedChange({ area_defaults: data.area_defaults });
      toast.success(`${data.area_defaults.length} cupboard names published as suggestions`);
    } catch (e) { toast.error(apiError(e, "Couldn't publish right now")); }
  };

  const labelled = areas.map((a) => (isTop(a) ? a : { ...a, name: `${areas.find((p) => p.id === a.parent_id).name} › ${a.name}` }));
  const groups = rainbowGroups(results, zones);
  const groupKeys = groups.map((g) => g.key || "none");
  const open = groupKeys.filter((k) => !folds.includes(k));
  const focused = groupKeys.length > 1 && open.length === 1 ? open[0] : null;
  const coloured = Object.keys(zones).length > 0;
  const renderArea = ({ area: a, visible, visibleLinked, subs = [] }, parent) => {
    const kids = parent ? [] : subsOf(a.id);
    const pin = pinFor[a.id] || (parent && pinFor[parent.id]);
    const ro = locked(a);
    const crewSub = readOnly && !!parent;
    return (
      <InventoryArea key={a.id} area={a} sub={!!parent} colour={zones[a.id]?.hex || (coloured ? "var(--line)" : undefined)} subCount={kids.length} subItems={kids.reduce((n, k) => n + (k.items || []).length + (linked[k.id] || []).length, 0)} readOnly={ro} onAdd={addItem(a)} query={q} visible={visible}
        path={q ? [zones[a.id]?.map, parent?.name].filter(Boolean).join(" › ") : ""}
        linked={linked[a.id]} visibleLinked={visibleLinked} onToggleLinked={onToggleLinked}
        onScan={boat && !boat.owner_id ? startScan(a) : undefined} scanning={scanning === a.id} defaultOpen={!parent && fresh === a.id}
        focusAt={focus && (focus.id === a.id || kids.some((k) => k.id === focus.id)) ? focus.at : 0}
        onShowOnMap={pin ? () => setMapFocus({ ...pin, at: Date.now() }) : undefined}
        onToggle={(i) => setArea(a.id, (x) => ({ ...x, items: x.items.map((y) => (y.id === i.id ? { ...y, removed: !y.removed } : y)) }))}
        onEditItem={(i) => setDialog({ type: "item", area: a, item: i })}
        onDeleteItem={(i) => setDialog({ type: "deleteItem", area: a, item: i })}
        onRename={() => setDialog({ type: "rename", area: a })} onDelete={() => setDialog({ type: "delete", area: a })} onMove={readOnly ? undefined : () => startMove(a)}
        onToggleFood={crewSub ? undefined : flag(a, "food", `${a.name} is now a Food area. Its items count as stock for the MPA.`, `${a.name} is no longer a Food area`)}
        onToggleDrinks={crewSub ? undefined : flag(a, "drinks", `${a.name} is now a Drinks area for the Magic Bartender.`, `${a.name} is no longer a Drinks area`)}
        zoneButton={parent || !boat ? null : <AreaZoneButton area={a} zone={zones[a.id]} zones={pickZones} boatId={boat.key || boat.boat_id} onPick={(z) => { setArea(a.id, (x) => ({ ...x, zone: { label: z.label, colour: z.colour } })); toast.success(`${a.name} is now in ${z.label} – ${z.colour}`); }} />}>
        {!parent && subs.length > 0 && <ul className="flex flex-col border-t border-[var(--line)] pt-2" data-testid={`inventory-subs-${a.id}`}>{subs.map((s) => renderArea(s, a))}</ul>}
        {!readOnly && !q && <SubAreaTools area={a} sub={!!parent} parentName={parent?.name} canMerge={!kids.length && tops.length > 1}
          onAddSub={() => setDialog({ type: "sub", area: a })} onMerge={() => setDialog({ type: "merge", area: a })} onTakeOut={() => takeOut(a)} />}
      </InventoryArea>
    );
  };

  return (
    <section className="flex flex-col gap-3" data-testid="inventory-list">
      <ZoneMap version={shared.zone_map_v} admin={admin} online={online} onChanged={(v) => onSharedChange({ zone_map_v: v })}
        boat={boat} details={details} canEdit={!readOnly} onBoatMaps={onBoatMaps} areas={areas} onOpenArea={openArea} onAddAreas={addAreasNamed} onZoneDefaults={addZoneDefaults} focusPin={mapFocus} onSignOff={onSignOff} onZone={boat && !boat.owner_id ? setZone : undefined} />
      {!readOnly && suggestions.length > 0 && (
        <button type="button" className="btn-ghost h-12 justify-center" onClick={() => setDialog({ type: "suggest" })} data-testid="inventory-suggest-btn">
          <Lightbulb className="h-4 w-4" /> Add from suggested cupboards ({suggestions.length})
        </button>
      )}
      {areas.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-[var(--navy)] bg-white px-3" data-testid="inventory-search">
            <Search className="h-5 w-5 shrink-0 text-[var(--navy)]" />
            <input type="text" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an item, e.g. impeller" aria-label="Search inventory"
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none" data-testid="inventory-search-input" />
            {query && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")} data-testid="inventory-search-clear"><X className="h-5 w-5" /></button>}
          </label>
          {q && <p className="text-sm font-semibold text-[var(--muted)]" data-testid="inventory-search-summary">
            {results.length ? `${found} found in ${results.length} ${results.length === 1 ? "cupboard" : "cupboards"}${out ? ` · ${out} removed for now` : ""}` : `Nothing matches "${query.trim()}"`}</p>}
        </div>
      )}
      {readOnly ? <>
        {areas.length === 0 && <p className="rounded-lg border-[1.5px] border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]" data-testid="inventory-empty">The skipper hasn't added any cupboards yet.</p>}
        {crewFood && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900" data-testid="inventory-crew-fd-note">You can add, change and remove the Food (F) and Drink (D) cupboards. The skipper looks after the rest.</p>}
      </> : (
        <InventoryInstructions searching={!!q} online={online} />
      )}
      <ul className="flex flex-col gap-2" data-testid="inventory-areas">
        {groups.map((g) => {
          const k = g.key || "none";
          const shut = !q && folds.includes(k);
          return [
            coloured && (
              <li key={`group-${k}`} className="flex items-center gap-1" data-testid={`inventory-colour-group-${k.toLowerCase()}`}>
                <button type="button" onClick={() => toggleFold(k)} aria-expanded={!shut} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 pt-1 text-left text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid={`inventory-colour-group-${k.toLowerCase()}-toggle`}>
                  <ChevronDown className={`h-4 w-4 shrink-0 [transition:transform_.15s] ${shut ? "-rotate-90" : ""}`} />
                  <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-black/20" style={{ backgroundColor: g.zone ? g.zone.hex : "transparent" }} />
                  <span className="min-w-0" data-testid={`inventory-colour-group-${k.toLowerCase()}-label`}>{g.zone ? g.zone.map : "Not on a zone map"} - {g.rows.length}</span>
                </button>
                {!q && groups.length > 1 && (focused === k
                  ? <button type="button" onClick={() => setFoldList([])} className="btn-ghost h-8 shrink-0 gap-1 px-2 text-[11px]" data-testid={`inventory-colour-group-${k.toLowerCase()}-all-btn`}><Layers className="h-3.5 w-3.5" /> Show all zones</button>
                  : <button type="button" onClick={() => setFoldList(groups.map((x) => x.key || "none").filter((x) => x !== k))} className="btn-ghost h-8 shrink-0 gap-1 px-2 text-[11px]" title="Fold every other zone"
                    data-testid={`inventory-colour-group-${k.toLowerCase()}-focus-btn`}><Focus className="h-3.5 w-3.5" /> Show only this zone</button>)}
              </li>
            ),
            ...(shut ? [] : g.rows.map((r) => renderArea(r))),
          ];
        })}
      </ul>
      {qrArea && <QrScanDialog area={qrArea} zone={zones[qrArea.id] || zones[qrArea.parent_id]} boat={boat} crew={readOnly} online={online} onSave={saveQr} onClose={() => setQrArea(null)} onSyncStores={onSyncStores} />}
      {!q && <FolderCardsButton areas={areas} zones={zones} vessel={vessel} online={online} boat={boat} ownerId={user.user_id} />}
      {readOnly && crewFood && !q && <AddArea onAdd={(name) => addArea(name, { food: true })} placeholder="Add a Food area, e.g. Fridge or Dry Foods Store" />}
      {!readOnly && !q && (boatZoneList.length
        ? <ZonePicker zones={boatZoneList} counts={zoneCounts} onPick={setZone}><AddArea onAdd={addArea} onBatch={() => (online ? setZonePrompt(true) : toast.error("Batch Magic Scan needs a signal"))} /></ZonePicker>
        : <AddArea onAdd={addArea} onBatch={boat && !boat.owner_id ? openBatch : undefined} />)}
      <BatchZonePrompt open={zonePrompt} zones={boatZoneList} help={batchHelp} counts={zoneCounts} onClose={() => setZonePrompt(false)}
        onZone={(z) => { setZonePrompt(false); scanZone(z); }} onWholeBoat={() => { setZonePrompt(false); openBatch(); }} />
      {batchOpen && <BatchScanDialog open boatId={boat.boat_id} areas={areas} zone={batchZone} boat={boat} onClose={closeBatch} onConfirm={applyBatch} />}
      <ZoneDialog zone={zone} boat={boat} online={online} areaCount={zone ? zoneCounts[zone.colour] || 0 : 0} onMaps={onBoatMaps} onScan={scanZone} onClose={() => setZone(null)} />
      {admin && !readOnly && areas.length > 0 && (
        <button type="button" className="btn-ghost h-11 justify-center text-sm" onClick={publish} data-testid="inventory-publish-defaults-btn">
          <UploadCloud className="h-4 w-4" /> Publish these cupboard names as suggestions for every skipper
        </button>
      )}
      <SuggestAreasDialog open={dialog?.type === "suggest"} names={suggestions} onClose={() => setDialog(null)} onConfirm={(names) => { addSuggested(names); setDialog(null); }} />
      <AreaEditDialog area={dialog?.type === "rename" ? dialog.area : null} zoneName={dialog?.type === "rename" ? zones[dialog.area.id]?.map : ""} onSave={renameArea} onClose={() => setDialog(null)} />
      <TextDialog open={dialog?.type === "sub"} title={dialog?.type === "sub" ? `Add a folder or box to ${dialog.area.name}` : ""} confirmLabel="Add" testId="inventory-sub"
        description="Take the folder or box out, empty it, then Magic Scan a photo of its contents. Only the list is kept, not the photo."
        placeholder="e.g. Red folder" initial="" onConfirm={dialog?.type === "sub" ? addSub : () => true} onClose={() => setDialog(null)} />
      <MergeAreaDialog area={dialog?.type === "merge" ? dialog.area : null} onMerge={mergeInto} onClose={() => setDialog(null)} zones={zones}
        parents={dialog?.type === "merge" ? tops.filter((t) => t.id !== dialog.area.id) : []} />
      <InventoryItemDialog open={dialog?.type === "item"} item={dialog?.item} areaId={dialog?.area?.id} areas={readOnly ? labelled.filter(crewCan) : labelled} zones={zones} onConfirm={saveItem} onClose={() => setDialog(null)} />
      <ConfirmDelete item={dialog?.type === "deleteItem" ? dialog.item : null} testId="inventory-item-delete" note={dialog?.type === "deleteItem" ? `It comes off ${dialog.area.name}'s list.` : ""}
        onClose={() => setDialog(null)} onConfirm={() => { deleteItem(dialog.area, dialog.item); setDialog(null); }} />
      <ConfirmDelete item={dialog?.type === "delete" ? dialog.area : null} note={`Everything listed inside it${dialog?.type === "delete" && subsOf(dialog.area.id).length ? ", including its folders and boxes," : ""} is removed too, and checklist items tagged with it lose their tag.`}
        onClose={() => setDialog(null)} onConfirm={() => { deleteArea(dialog.area); setDialog(null); }} />
      <ScanReviewDialog scan={scan} onSave={saveScan} onClose={() => setScan(null)} />
      <MoveAreaDialog source={dialog?.type === "move" ? dialog.area : null} areas={labelled} zones={zones} links={dialog?.type === "move" ? linked[dialog.area.id] : []}
        onMove={finishMove} onClose={() => setDialog(null)} />
    </section>
  );
};
