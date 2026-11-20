import { useState } from "react";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { matches } from "@/components/boat/Highlight";
import { areaZones } from "@/lib/zoneColours";

// Boat Inventory search from the home screen: the same cupboard, box and item matching, with the results in this window.
const searchAreas = (boat, areas, q) => {
  if (!q) return [];
  const zones = areaZones(boat, areas);
  const byId = new Map(areas.map((a) => [a.id, a]));
  return areas.flatMap((a) => {
    const parent = a.parent_id && a.parent_id !== a.id ? byId.get(a.parent_id) : null;
    const whole = matches(a.name, q) || (parent && matches(parent.name, q));
    const items = (a.items || []).filter((i) => whole || matches(i.name, q));
    if (!items.length && !matches(a.name, q)) return [];
    const zone = zones[a.id]?.map || (parent && zones[parent.id]?.map) || "";
    return [{ area: a, parent, zone, items }];
  });
};

export const InventorySearchDialog = ({ open, boat, areas = [], onOpenArea, onClose }) => {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = searchAreas(boat, areas, q);
  const found = rows.reduce((n, r) => n + r.items.reduce((m, i) => m + (i.qty || 1), 0), 0);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-lg flex-col border-[1.5px] border-[var(--navy)]" data-testid="inventory-search-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold">Search Boat Inventory</DialogTitle>
          <DialogDescription>Find what's in which cupboard, box or folder.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border-[1.5px] border-[var(--navy)] bg-white px-3">
          <Search className="h-5 w-5 shrink-0 text-[var(--muted)]" />
          <input autoFocus type="text" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an item, e.g. impeller" aria-label="Search inventory"
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none" data-testid="inventory-search-dialog-input" />
          {query && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")} data-testid="inventory-search-dialog-clear"><X className="h-5 w-5" /></button>}
        </div>
        {q && <p className="text-sm font-bold text-[var(--muted)]" data-testid="inventory-search-dialog-count">
          {rows.length ? `${found} found in ${rows.length} ${rows.length === 1 ? "place" : "places"}` : `Nothing matches "${query.trim()}"`}</p>}
        <ul className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1 pb-1" data-testid="inventory-search-dialog-results">
          {rows.map(({ area, parent, zone, items }) => (
            <li key={area.id} className="rounded-md border-[1.5px] border-[var(--line)] bg-white p-3" data-testid={`inventory-search-result-${area.id}`}>
              <button type="button" onClick={() => onOpenArea(parent?.id || area.id)} className="text-left text-sm font-extrabold text-[var(--navy)] underline-offset-2 hover:underline" data-testid={`inventory-search-open-${area.id}`}>
                {[zone, parent?.name, area.name].filter(Boolean).join(" › ")}
              </button>
              {items.length > 0 && <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                {items.map((i) => (
                  <li key={i.id} className={i.removed ? "text-[var(--muted)] line-through" : ""}>{i.name}{i.qty > 1 ? ` ×${i.qty}` : ""}{i.removed ? " (removed for now)" : ""}</li>
                ))}
              </ul>}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
};
