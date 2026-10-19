import { useState } from "react";
import { toast } from "sonner";
import { Lightbulb, Plus, Search, UploadCloud, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { ZoneMap } from "@/components/boat/ZoneMap";
import { InventoryArea } from "@/components/boat/InventoryArea";
import { InventoryItemDialog } from "@/components/boat/InventoryItemDialog";
import { SuggestAreasDialog } from "@/components/boat/SuggestAreasDialog";
import { TextDialog } from "@/components/boat/TextDialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const AddArea = ({ onAdd }) => {
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
      </div>
      {error && <p className="text-sm font-semibold text-[var(--red)]" data-testid="inventory-add-area-error">{error}</p>}
    </form>
  );
};

export const InventoryList = ({ areas, onChange, readOnly, admin, online, shared, onSharedChange, boat, onBoatMaps }) => {
  const [dialog, setDialog] = useState(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = !q ? areas.map((a) => ({ area: a })) : areas.flatMap((a) => {
    if (a.name.toLowerCase().includes(q)) return [{ area: a, visible: a.items || [] }];
    const hits = (a.items || []).filter((i) => i.name.toLowerCase().includes(q));
    return hits.length ? [{ area: a, visible: hits }] : [];
  });
  const suggestions = shared.area_defaults.filter((n) => !areas.some((a) => same(a.name, n)));
  const setArea = (id, fn) => onChange((list) => list.map((a) => (a.id === id ? fn(a) : a)));

  const addArea = (name) => {
    if (!name) return "Please enter a cupboard or locker name";
    if (areas.some((a) => same(a.name, name))) return `${name} is already on your list`;
    onChange((list) => [...list, { id: newId(), name, items: [] }]);
    return true;
  };
  const addSuggested = (names) => onChange((list) => [...list, ...names.map((name) => ({ id: newId(), name, items: [] }))]);
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
    setArea(area.id, (a) => ({ ...a, items: [...(a.items || []), { id: newId(), name, qty, onboard: false }] }));
    return true;
  };
  const saveItem = ({ name, qty }) => {
    const { area, item } = dialog;
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
        boat={boat} canEdit={!readOnly} onBoatMaps={onBoatMaps} />
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
            {results.length ? `Found in ${results.length} ${results.length === 1 ? "cupboard" : "cupboards"}` : `Nothing matches "${query.trim()}"`}</p>}
        </div>
      )}
      {areas.length === 0 && <p className="rounded-lg border-[1.5px] border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]" data-testid="inventory-empty">
        {readOnly ? "The skipper hasn't added any cupboards yet." : "List each cupboard, locker or lazarette, then add what's stowed inside and tick it when it's on board."}</p>}
      <ul className="flex flex-col gap-2">
        {results.map(({ area: a, visible }) => (
          <InventoryArea key={a.id} area={a} readOnly={readOnly} onAdd={addItem(a)} query={q} visible={visible}
            onToggle={(i) => setArea(a.id, (x) => ({ ...x, items: x.items.map((y) => (y.id === i.id ? { ...y, onboard: !y.onboard } : y)) }))}
            onEditItem={(i) => setDialog({ type: "item", area: a, item: i })}
            onDeleteItem={(i) => setArea(a.id, (x) => ({ ...x, items: x.items.filter((y) => y.id !== i.id) }))}
            onRename={() => setDialog({ type: "rename", area: a })} onDelete={() => setDialog({ type: "delete", area: a })} />
        ))}
      </ul>
      {!readOnly && !q && <AddArea onAdd={addArea} />}
      {admin && !readOnly && areas.length > 0 && (
        <button type="button" className="btn-ghost h-11 justify-center text-sm" onClick={publish} data-testid="inventory-publish-defaults-btn">
          <UploadCloud className="h-4 w-4" /> Publish these cupboard names as suggestions for every skipper
        </button>
      )}
      <SuggestAreasDialog open={dialog?.type === "suggest"} names={suggestions} onClose={() => setDialog(null)} onConfirm={(names) => { addSuggested(names); setDialog(null); }} />
      <TextDialog open={dialog?.type === "rename"} title="Rename Cupboard" confirmLabel="Save" testId="inventory-rename"
        initial={dialog?.type === "rename" ? dialog.area.name : ""} onConfirm={dialog?.type === "rename" ? renameArea : () => true} onClose={() => setDialog(null)} />
      <InventoryItemDialog open={dialog?.type === "item"} item={dialog?.item} onConfirm={saveItem} onClose={() => setDialog(null)} />
      <ConfirmDelete item={dialog?.type === "delete" ? dialog.area : null} note="Everything listed inside it is removed too, and checklist items tagged with it lose their tag."
        onClose={() => setDialog(null)} onConfirm={() => { const { id } = dialog.area; onChange((list) => list.filter((a) => a.id !== id)); setDialog(null); }} />
    </section>
  );
};
