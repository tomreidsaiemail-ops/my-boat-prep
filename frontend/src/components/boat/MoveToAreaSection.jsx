import { MapPin } from "lucide-react";

// Edit List Panel section: pick a boat area, then tick the items to move there. Items with no area start ticked.
export const MoveToAreaSection = ({ areas, items, labelFor, areaOf, move, onChange }) => {
  const placed = (i) => i.area === move.area && !!areaOf(i);
  const choose = (area) => onChange({ area, ids: area ? items.filter((i) => !areaOf(i)).map((i) => i.id) : [] });
  const open = items.filter((i) => !placed(i));
  const all = open.length > 0 && open.every((i) => move.ids.includes(i.id));
  const toggle = (id, on) => onChange({ ...move, ids: on ? [...move.ids, id] : move.ids.filter((x) => x !== id) });
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] p-3" data-testid="move-area-section">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-bold"><MapPin className="h-4 w-4 text-[var(--navy)]" /> Move items to an area</legend>
      <select value={move.area} onChange={(e) => choose(e.target.value)} className="field-input font-normal" aria-label="Boat area to move items to" data-testid="move-area-select">
        <option value="">Choose a boat area (optional)</option>
        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {move.area && (
        <div className="max-h-[40vh] overflow-y-auto rounded-md border-[1.5px] border-[var(--line)]" data-testid="move-area-items">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b-[1.5px] border-[var(--line)] bg-slate-50 px-3 text-sm font-bold">
            <input type="checkbox" checked={all} onChange={(e) => onChange({ ...move, ids: e.target.checked ? open.map((i) => i.id) : [] })} className="h-5 w-5 accent-[var(--navy)]" data-testid="move-area-all" /> Select All
          </label>
          {items.map((i) => {
            const here = placed(i);
            const now = areaOf(i);
            return (
              <label key={i.id} className={`flex min-h-[44px] items-center gap-3 border-b border-[var(--line)] px-3 py-1.5 text-sm last:border-0 ${here ? "opacity-60" : "cursor-pointer"}`} data-testid={`move-area-option-${i.id}-label`}>
                <input type="checkbox" checked={here || move.ids.includes(i.id)} disabled={here} onChange={(e) => toggle(i.id, e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`move-area-option-${i.id}`} />
                <span className="min-w-0 flex-1 break-words">{labelFor(i)}</span>
                {now && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-[var(--muted)]" data-testid={`move-area-current-${i.id}`}>{here ? "Already here" : now}</span>}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
};
