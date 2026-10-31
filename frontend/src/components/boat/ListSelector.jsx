import { Copy, Pencil, Plus, User } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

const BTN = "flex h-14 w-12 shrink-0 items-center justify-center rounded-md border-2 border-[var(--navy)] bg-white text-[var(--navy)] hover:bg-[var(--navy)] hover:text-white active:scale-95 [transition:background-color_.15s,color_.15s,transform_.1s]";

const Row = ({ row, updated }) => (
  <SelectItem value={row.list.id} data-testid={`list-option-${row.list.id}`} style={{ backgroundColor: row.colours.shade, borderLeftColor: row.colours.bg }}
    className="my-0.5 min-h-11 cursor-pointer border-l-4 py-2 pl-3 font-display text-base font-bold text-[var(--navy)] data-[highlighted]:ring-2 data-[highlighted]:ring-[var(--blue)]/40">
    <span className="flex items-center gap-2">
      {row.user && <User className="h-4 w-4 shrink-0" aria-label="Your list" data-testid={`list-option-user-${row.list.id}`} />}
      <span className="truncate">{row.list.name}{updated ? " • Updated" : ""}</span>
    </span>
  </SelectItem>
);

export const ListSelector = ({ sections, activeId, activeColours, onChange, onCreate, onClone, onRename, updatedIds = [] }) => (
  <div className="flex items-stretch gap-2">
    <div className="relative min-w-0 flex-1">
      <Select value={activeId} onValueChange={onChange}>
        <SelectTrigger data-testid="list-selector" aria-label="Choose a list" style={{ backgroundColor: activeColours?.shade, borderLeftColor: activeColours?.bg }}
          className="h-14 w-full rounded-md border-2 border-l-[6px] border-[var(--navy)] bg-white pl-3 pr-3 text-left font-display text-lg font-bold text-[var(--navy)] shadow-none focus:outline-none focus:ring-4 focus:ring-[var(--blue)]/30 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:opacity-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[65vh] border-2 border-[var(--navy)] bg-white" data-testid="list-selector-menu">
          {sections.map((s, i) => (
            <SelectGroup key={s.key} data-testid={`list-section-${s.key}`}>
              {i > 0 && <SelectSeparator />}
              {s.label && <SelectLabel className="pt-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{s.label}</SelectLabel>}
              {s.rows.map((r) => <Row key={r.list.id} row={r} updated={updatedIds.includes(r.list.id)} />)}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
    <button type="button" data-testid="create-list-btn" onClick={onCreate} title="Create New List" aria-label="Create New List" className={BTN}>
      <Plus className="h-6 w-6" strokeWidth={3} />
    </button>
    <button type="button" data-testid="clone-list-btn" onClick={onClone} title="Clone List" aria-label="Clone List" className={BTN}>
      <Copy className="h-6 w-6" strokeWidth={2.5} />
    </button>
    <button type="button" data-testid="rename-list-btn" onClick={onRename} title="Rename List" aria-label="Rename List" className={BTN}>
      <Pencil className="h-5 w-5" strokeWidth={2.5} />
    </button>
  </div>
);
