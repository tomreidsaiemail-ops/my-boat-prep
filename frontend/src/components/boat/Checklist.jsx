import { ArrowDown, ArrowUp, Check, Flag, MapPin, Pencil, Trash2 } from "lucide-react";
import { OrderNumber } from "@/components/boat/OrderNumber";

const PriorityTools = ({ item, first, last, onFlag, onMove }) => (
  <div className="flex items-center gap-1 pb-2 pl-12" data-testid={`priority-tools-${item.id}`}>
    <button type="button" className={`prio-btn ${item.flagged ? "!text-[var(--red)]" : ""}`} onClick={onFlag} aria-pressed={!!item.flagged}
      aria-label={item.flagged ? "Remove flag" : "Flag as urgent"} title={item.flagged ? "Remove flag" : "Flag as urgent"} data-testid={`checklist-item-flag-${item.id}`}>
      <Flag className={`h-5 w-5 ${item.flagged ? "fill-current" : ""}`} />
    </button>
    <button type="button" className="prio-btn" onClick={() => onMove(-1)} disabled={first} aria-label="Move up" data-testid={`checklist-item-up-${item.id}`}><ArrowUp className="h-5 w-5" /></button>
    <button type="button" className="prio-btn" onClick={() => onMove(1)} disabled={last} aria-label="Move down" data-testid={`checklist-item-down-${item.id}`}><ArrowDown className="h-5 w-5" /></button>
  </div>
);

const Row = ({ item, text, onToggle, onEdit, onDelete, emergency, tools, number, tickOnly, area }) => (
  <li className={`checklist-row ${item.checked ? "is-checked" : ""} ${item.flagged ? "is-flagged" : ""}`} data-testid={`checklist-item-${item.id}`}>
    {number && <div className="shrink-0 pl-2 pt-3">{number}</div>}
    <div className="flex min-w-0 flex-1 flex-col">
      <button type="button" role="checkbox" aria-checked={item.checked} onClick={onToggle} data-testid={`checklist-item-toggle-${item.id}`}
        className={`flex min-h-[56px] flex-1 items-start gap-3 py-3 text-left ${number ? "pl-2" : "pl-3"}`}>
        <span className={`tick-box ${emergency ? `tick-${emergency}` : ""}`}>{item.checked && <Check className="h-5 w-5" strokeWidth={3.5} />}</span>
        <span className="flex min-w-0 flex-col items-start gap-1 pt-0.5">
          <span className={`item-text ${emergency ? "text-[17px] font-semibold" : ""}`} data-testid={`checklist-item-text-${item.id}`}>{text}</span>
          {area && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-900" data-testid={`checklist-item-area-${item.id}`}><MapPin className="h-3 w-3" />{area}</span>}
        </span>
      </button>
      {tools}
    </div>
    {!tickOnly && <div className="flex shrink-0 items-center pr-1">
      <button type="button" className="icon-btn" aria-label="Edit item" onClick={onEdit} data-testid={`checklist-item-edit-${item.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
      <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Delete item" onClick={onDelete} data-testid={`checklist-item-delete-${item.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
    </div>}
  </li>
);

export const Checklist = ({ items, labelFor, onToggle, onEdit, onDelete, onDeleteList, emergency, ordering, onFlag, onMove, onPlace, tickOnly, areaOf = () => null }) => {
  const tools = ordering && !tickOnly;
  return (
    <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="checklist">
      {items.length === 0 && (
        <li className="flex items-center justify-between gap-3 p-4 text-sm font-medium text-[var(--muted)]" data-testid="checklist-empty">
          <span>{tickOnly ? "No items on this list yet." : "No items yet. Add your first task below."}</span>
          {!tickOnly && <button type="button" className="icon-btn shrink-0 hover:text-[var(--red)]" aria-label="Delete this list" title="Delete this list"
            onClick={onDeleteList} data-testid="delete-list-btn"><Trash2 className="h-[18px] w-[18px]" /></button>}
        </li>
      )}
      {items.map((item, i) => (
        <Row key={item.id} item={item} text={labelFor(item)} emergency={emergency} tickOnly={tickOnly} area={areaOf(item)}
          onToggle={() => onToggle(item.id)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)}
          number={tools && <OrderNumber key={`${item.id}-${i}`} id={item.id} pos={i + 1} total={items.length} onPlace={(n) => onPlace(item.id, n)} />}
          tools={tools && <PriorityTools item={item} first={i === 0} last={i === items.length - 1} onFlag={() => onFlag(item.id)} onMove={(d) => onMove(item.id, d)} />} />
      ))}
    </ul>
  );
};
