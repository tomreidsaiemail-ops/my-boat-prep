import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lightbulb, Plus, Search, UploadCloud, X } from "lucide-react";
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

const newId = newAreaItemId;
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const AddArea = ({ onAdd, onBatch }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const res = onAdd(name.trim());
    if (typeof res === "string") { setError(res); return; }
    setName(""); setError("");
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-1" data-testid="inventory-add-area-form">
      <div className="flex gap-2">
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Add a cupboard or locker, e.g. Aft starboard lazarette"
          aria-label="Cupboard or locker name" className="field-input h-12 min-w-0 flex-1" data-testid="inventory-add-area-input" />
        <button type="submit" className="btn-solid h-12 w-12 shrink-0 justify-center p-0" aria-label="Add cupboard" data-testid="inventory-add-area-btn"><Plus className="h-5 w-5" /></button>
        {onBatch && <button type="button" onClick={onBatch} className="btn-solid h-12 w-14 shrink-0 justify-center gap-0 p-0" aria-label="Batch Magic Scan: add several boat areas with photos" title="Batch Magic Scan"
          data-testid="inventory-batch-scan-btn"><Plus className="-mr-1.5 h-5 w-5" /><Plus className="h-5 w-5" /></button>}
      </div>
      {error && <p className="text-sm font-semibold text-[var(--red)]" data-testid="inventory-add-area-error">{error}</p>}
    </form>
  );
};

export const InventoryList = ({ areas, onChange, readOnly, admin, online, shared, onSharedChange, boat, onBoatMaps, linked = {}, onToggleLinked, onMoveItems, batchRequest, onBatchHandled }) => {
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
      if (data.scans_left <= 3) toast.message(`${data.scans_left} AI scans left today`);
    } catch (err) { toast.error(apiError(err, "The AI scan didn't work, please try again")); } finally { setScanning(null); }
  };
  const saveScan = (list) => {
    const { area } = scan;
    setArea(area.id, (x) => ({ ...x, items: list.map((i) => ({ id: newId(), name: i.name, qty: i.qty })) }));
    setScan(null);
    toast.success(`${area.name} now lists ${list.length} ${list.length === 1 ? "item" : "items"}`);
  };
  const q = query.trim().toLowerCase();
  const results = !q ? areas.map((a) => ({ area: a })) : areas.flatMap((a) => {
    const links = linked[a.id] || [];
    if (matches(a.name, q)) return [{ area: a, visible: a.items || [], visibleLinked: links }];
    const hits = (a.items || []).filter((i) => matches(i.name, q));
    const linkHits = links.filter((l) => matches(`${l.listName} ${l.text}`, q));
    return hits.length || linkHits.length ? [{ area: a, visible: hits, visibleLinked: linkHits }] : [];
  });
  const found = results.reduce((n, r) => n + (r.visible || []).reduce((m, i) => m + (i.qty || 1), 0) + (r.visibleLinked || []).length, 0);
  const out = results.reduce((n, r) => n + (r.visible || []).filter((i) => i.removed).length, 0);
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
  // Checklist tags point at the area id, so restoring the same area brings its tagged items back too.
  const deleteArea = (area) => {
    const index = areas.findIndex((a) => a.id === area.id);
    const saved = areas[index];
    onChange((list) => list.filter((a) => a.id !== area.id));
    undoToast(area.name, () => onChange((list) => {
      if (list.some((a) => a.id === area.id)) return list;
      const next = [...list];
      next.splice(Math.min(index, next.length), 0, saved);
      return next;
    }));
  };
  const startMove = (a) => {
    if (areas.length < 2) { toast.warning("You can only move items to new boat areas when there is more than one boat area."); return; }
    if (!(a.items || []).length && !(linked[a.id] || []).length) { toast.message(`${a.name} has nothing to move yet`); return; }
    setDialog({ type: "move", area: a });
  };
  const finishMove = (plan, count) => {
    const { area } = dialog;
    if (onMoveItems(plan) === false) return;
    setDialog(null);
    toast.success(`Moved ${count} ${count === 1 ? "item" : "items"} from ${area.name}`);
  };

  const addArea = (name) => {
    if (!name) return "Please enter a cupboard or locker name";
    if (areas.some((a) => same(a.name, name))) return `${name} is already on your list`;
    const id = newId();
    setFresh(id);
    onChange((list) => [...list, { id, name, items: [] }]);
    return true;
  };
  const addSuggested = (names) => onChange((list) => [...list, ...names.map((name) => ({ id: newId(), name, items: [] }))]);
  const addAreasNamed = (names) => {
    const ids = Object.fromEntries(names.map((n) => [n, newId()]));
    onChange((list) => [...list, ...names.filter((n) => !list.some((a) => same(a.name, n))).map((name) => ({ id: ids[name], name, items: [] }))]);
    return ids;
  };
  const [focus, setFocus] = useState(null);
  const openArea = (id) => {
    setQuery("");
    setFocus({ id, at: Date.now() });
    setTimeout(() => document.querySelector(`[data-testid="inventory-area-${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const [batchOpen, setBatchOpen] = useState(false);
  useEffect(() => {
    if (!batchRequest) return;
    onBatchHandled();
    if (boat && !boat.owner_id && !readOnly) setBatchOpen(true);
  }, [batchRequest]); // eslint-disable-line react-hooks/exhaustive-deps
  const openBatch = () => (online ? setBatchOpen(true) : toast.error("Batch Magic Scan needs a signal"));
  const applyBatch = (list) => {
    const toItems = (items) => items.map((i) => ({ id: newId(), name: i.name, qty: i.qty }));
    onChange((cur) => {
      const next = [...cur];
      list.forEach(({ name, items }) => {
        const at = next.findIndex((a) => same(a.name, name));
        if (at >= 0) next[at] = { ...next[at], items: toItems(items) };
        else next.push({ id: newId(), name, items: toItems(items) });
      });
      return next;
    });
    setBatchOpen(false);
    const count = list.reduce((n, a) => n + a.items.length, 0);
    const replaced = list.filter((a) => areas.some((x) => same(x.name, a.name))).length;
    const added = list.length - replaced;
    const parts = [added && `${added} boat ${added === 1 ? "area" : "areas"} added`, replaced && `${replaced} replaced`].filter(Boolean).join(", ");
    toast.success(`${parts} with ${count} ${count === 1 ? "item" : "items"}`);
  };
  const renameArea = (name) => {
    const { area } = dialog;
    if (!name) return "Please enter a name";
    if (areas.some((a) => a.id !== area.id && same(a.name, name))) return `${name} is already on your list`;
    setArea(area.id, (a) => ({ ...a, name }));
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

  return (
    <section className="flex flex-col gap-3" data-testid="inventory-list">
      <ZoneMap version={shared.zone_map_v} admin={admin} online={online} onChanged={(v) => onSharedChange({ zone_map_v: v })}
        boat={boat} canEdit={!readOnly} onBoatMaps={onBoatMaps} areas={areas} onOpenArea={openArea} onAddAreas={addAreasNamed} />
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
      {readOnly ? areas.length === 0 && <p className="rounded-lg border-[1.5px] border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]" data-testid="inventory-empty">The skipper hasn't added any cupboards yet.</p> : (
        <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]" data-testid="inventory-instructions">
          <p data-testid="inventory-instructions-text">List each cupboard, lazarette, drawer, shelf, fridge, freezer etc then add what's stowed inside. You can tick an item to show it's been removed temporarily, e.g. a knife moved to the cockpit ready for passage.</p>
          <p data-testid="inventory-skipper-tip"><b className="text-[var(--navy)]">Skipper's tip:</b> Use ++ below. This saves lots of time because while you take photos, the Magic Scan runs in the background. Taking the boat inventory should take 30 minutes for a 40 foot yacht, longer for larger vessels, shorter for Launches and Runabouts.</p>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {results.map(({ area: a, visible, visibleLinked }) => (
          <InventoryArea key={a.id} area={a} readOnly={readOnly} onAdd={addItem(a)} query={q} visible={visible}
            linked={linked[a.id]} visibleLinked={visibleLinked} onToggleLinked={onToggleLinked}
            onScan={boat && !boat.owner_id ? startScan(a) : undefined} scanning={scanning === a.id} defaultOpen={fresh === a.id} focusAt={focus?.id === a.id ? focus.at : 0}
            onToggle={(i) => setArea(a.id, (x) => ({ ...x, items: x.items.map((y) => (y.id === i.id ? { ...y, removed: !y.removed } : y)) }))}
            onEditItem={(i) => setDialog({ type: "item", area: a, item: i })}
            onDeleteItem={(i) => deleteItem(a, i)}
            onRename={() => setDialog({ type: "rename", area: a })} onDelete={() => setDialog({ type: "delete", area: a })} onMove={() => startMove(a)} />
        ))}
      </ul>
      {!readOnly && !q && <AddArea onAdd={addArea} onBatch={boat && !boat.owner_id ? openBatch : undefined} />}
      {batchOpen && <BatchScanDialog open boatId={boat.boat_id} areas={areas} onClose={() => setBatchOpen(false)} onConfirm={applyBatch} />}
      {admin && !readOnly && areas.length > 0 && (
        <button type="button" className="btn-ghost h-11 justify-center text-sm" onClick={publish} data-testid="inventory-publish-defaults-btn">
          <UploadCloud className="h-4 w-4" /> Publish these cupboard names as suggestions for every skipper
        </button>
      )}
      <SuggestAreasDialog open={dialog?.type === "suggest"} names={suggestions} onClose={() => setDialog(null)} onConfirm={(names) => { addSuggested(names); setDialog(null); }} />
      <TextDialog open={dialog?.type === "rename"} title="Rename Cupboard" confirmLabel="Save" testId="inventory-rename"
        initial={dialog?.type === "rename" ? dialog.area.name : ""} onConfirm={dialog?.type === "rename" ? renameArea : () => true} onClose={() => setDialog(null)} />
      <InventoryItemDialog open={dialog?.type === "item"} item={dialog?.item} areaId={dialog?.area?.id} areas={areas} onConfirm={saveItem} onClose={() => setDialog(null)} />
      <ConfirmDelete item={dialog?.type === "delete" ? dialog.area : null} note="Everything listed inside it is removed too, and checklist items tagged with it lose their tag."
        onClose={() => setDialog(null)} onConfirm={() => { deleteArea(dialog.area); setDialog(null); }} />
      <ScanReviewDialog scan={scan} onSave={saveScan} onClose={() => setScan(null)} />
      <MoveAreaDialog source={dialog?.type === "move" ? dialog.area : null} areas={areas} links={dialog?.type === "move" ? linked[dialog.area.id] : []}
        onMove={finishMove} onClose={() => setDialog(null)} />
    </section>
  );
};
