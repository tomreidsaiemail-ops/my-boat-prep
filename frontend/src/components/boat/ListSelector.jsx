import { ChevronDown, Copy, Plus } from "lucide-react";

const BTN = "flex h-14 w-14 shrink-0 items-center justify-center rounded-md border-2 border-[var(--navy)] bg-white text-[var(--navy)] hover:bg-[var(--navy)] hover:text-white active:scale-95 [transition:background-color_.15s,color_.15s,transform_.1s]";

export const ListSelector = ({ registry, activeId, onChange, onCreate, onClone }) => (
  <div className="flex items-stretch gap-2">
    <div className="relative flex-1">
      <select
        data-testid="list-selector"
        value={activeId}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 w-full appearance-none rounded-md border-2 border-[var(--navy)] bg-white pl-4 pr-10 font-display text-lg font-bold text-[var(--navy)] focus:outline-none focus:ring-4 focus:ring-[var(--blue)]/30"
      >
        {registry.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2" />
    </div>
    <button type="button" data-testid="create-list-btn" onClick={onCreate} title="Create New List" aria-label="Create New List"
      className={BTN}>
      <Plus className="h-6 w-6" strokeWidth={3} />
    </button>
    <button type="button" data-testid="clone-list-btn" onClick={onClone} title="Clone List" aria-label="Clone List" className={BTN}>
      <Copy className="h-6 w-6" strokeWidth={2.5} />
    </button>
  </div>
);
