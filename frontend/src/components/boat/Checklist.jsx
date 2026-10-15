import { Check, Pencil, Trash2 } from "lucide-react";

const Row = ({ item, text, onToggle, onEdit, onDelete, emergency }) => (
  <li className={`checklist-row ${item.checked ? "is-checked" : ""}`} data-testid={`checklist-item-${item.id}`}>
    <button type="button" role="checkbox" aria-checked={item.checked} onClick={onToggle} data-testid={`checklist-item-toggle-${item.id}`}
      className="flex min-h-[56px] flex-1 items-start gap-3 py-3 pl-3 text-left">
      <span className={`tick-box ${emergency ? `tick-${emergency}` : ""}`}>{item.checked && <Check className="h-5 w-5" strokeWidth={3.5} />}</span>
      <span className={`item-text pt-0.5 ${emergency ? "text-[17px] font-semibold" : ""}`} data-testid={`checklist-item-text-${item.id}`}>{text}</span>
    </button>
    <div className="flex shrink-0 items-center pr-1">
      <button type="button" className="icon-btn" aria-label="Edit item" onClick={onEdit} data-testid={`checklist-item-edit-${item.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
      <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Delete item" onClick={onDelete} data-testid={`checklist-item-delete-${item.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
    </div>
  </li>
);

export const Checklist = ({ items, labelFor, onToggle, onEdit, onDelete, onDeleteList, emergency }) => (
  <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="checklist">
    {items.length === 0 && (
      <li className="flex items-center justify-between gap-3 p-4 text-sm font-medium text-[var(--muted)]" data-testid="checklist-empty">
        <span>No items yet. Add your first task below.</span>
        <button type="button" className="icon-btn shrink-0 hover:text-[var(--red)]" aria-label="Delete this list" title="Delete this list"
          onClick={onDeleteList} data-testid="delete-list-btn"><Trash2 className="h-[18px] w-[18px]" /></button>
      </li>
    )}
    {items.map((item) => (
      <Row key={item.id} item={item} text={labelFor(item)} emergency={emergency}
        onToggle={() => onToggle(item.id)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />
    ))}
  </ul>
);
