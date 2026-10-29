import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Flag, IndentDecrease, IndentIncrease, MapPin, Pencil, Trash2 } from "lucide-react";
import { OrderNumber } from "@/components/boat/OrderNumber";
import { outlineInfo } from "@/lib/outline";
import { MpaText } from "@/components/boat/MpaBadges";
import { MealTypeBadge } from "@/components/boat/MealTypePicker";

const PriorityTools = ({ item, info, onFlag, onMove, onIndent }) => (
  <div className="flex flex-wrap items-center gap-1 pb-2 pl-1" data-testid={`priority-tools-${item.id}`}>
    <button type="button" className={`prio-btn ${item.flagged ? "!text-[var(--red)]" : ""}`} onClick={onFlag} aria-pressed={!!item.flagged}
      aria-label={item.flagged ? "Remove flag" : "Flag as urgent"} title={item.flagged ? "Remove flag" : "Flag as urgent"} data-testid={`checklist-item-flag-${item.id}`}>
      <Flag className={`h-5 w-5 ${item.flagged ? "fill-current" : ""}`} />
    </button>
    <button type="button" className="prio-btn" onClick={() => onMove(-1)} disabled={!info.upOk} aria-label="Move up" data-testid={`checklist-item-up-${item.id}`}><ArrowUp className="h-5 w-5" /></button>
    <button type="button" className="prio-btn" onClick={() => onMove(1)} disabled={!info.downOk} aria-label="Move down" data-testid={`checklist-item-down-${item.id}`}><ArrowDown className="h-5 w-5" /></button>
    {info.canIndent && <button type="button" className="prio-btn" onClick={() => onIndent(true)} aria-label="Indent under the item above" title="Indent"
      data-testid={`checklist-item-indent-${item.id}`}><IndentIncrease className="h-5 w-5" /></button>}
    {info.child && <button type="button" className="prio-btn" onClick={() => onIndent(false)} aria-label="Unindent" title="Unindent"
      data-testid={`checklist-item-unindent-${item.id}`}><IndentDecrease className="h-5 w-5" /></button>}
  </div>
);

const FoldButton = ({ id, folded, onFold }) => (
  <button type="button" className="icon-btn" onClick={() => onFold(!folded)} aria-expanded={!folded}
    aria-label={folded ? "Show sub-items" : "Fold sub-items"} title={folded ? "Show sub-items" : "Fold sub-items"} data-testid={`checklist-item-fold-${id}`}>
    {folded ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
  </button>
);

const Row = ({ item, text, info, onToggle, onEdit, onDelete, emergency, tools, number, tickOnly, area, fold }) => (
  <li className={`checklist-row ${item.checked ? "is-checked" : ""} ${item.flagged ? "is-flagged" : ""} ${info?.shade ? "is-shaded" : ""} ${info?.child ? "is-child" : ""}`}
    data-testid={`checklist-item-${item.id}`} data-shaded={info?.shade ? "true" : "false"} data-indented={info?.child ? "true" : "false"}>
    {info?.child && <div className="w-7 shrink-0" aria-hidden="true" />}
    {number && <div className="shrink-0 pl-2 pt-3">{number}</div>}
    <div className="flex min-w-0 flex-1 flex-col">
      <button type="button" role="checkbox" aria-checked={item.checked} onClick={onToggle} data-testid={`checklist-item-toggle-${item.id}`}
        className={`flex min-h-[56px] flex-1 items-start gap-3 py-3 text-left ${number ? "pl-2" : "pl-3"}`}>
        <span className={`tick-box ${emergency ? `tick-${emergency}` : ""}`}>{item.checked && <Check className="h-5 w-5" strokeWidth={3.5} />}</span>
        <span className="flex min-w-0 flex-col items-start gap-1 pt-0.5">
          <span className={`item-text ${emergency ? "text-[17px] font-semibold" : ""}`} data-testid={`checklist-item-text-${item.id}`}><MpaText item={item} text={text} /></span>
          {area && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-900" data-testid={`checklist-item-area-${item.id}`}><MapPin className="h-3 w-3" />{area}</span>}
          {item.meal_type && !info?.child && <MealTypeBadge id={item.id} type={item.meal_type} />}
          {fold?.folded && <span className="text-xs font-bold text-sky-900" data-testid={`checklist-item-fold-summary-${item.id}`}>{info.subs} sub-item{info.subs === 1 ? "" : "s"} · {info.subsTicked} ticked</span>}
        </span>
      </button>
      {tools}
    </div>
    {fold && <div className="flex shrink-0 items-start pt-2"><FoldButton id={item.id} folded={fold.folded} onFold={fold.onFold} /></div>}
    {!tickOnly && <div className="flex shrink-0 items-center pr-1">
      <button type="button" className="icon-btn" aria-label="Edit item" onClick={onEdit} data-testid={`checklist-item-edit-${item.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
      <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Delete item" onClick={onDelete} data-testid={`checklist-item-delete-${item.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
    </div>}
  </li>
);

// `outline` is off while an area filter shows only part of the list, so groups and numbers would be misleading.
export const Checklist = ({ items, labelFor, onToggle, onEdit, onDelete, onDeleteList, emergency, ordering, outline = true, onFlag, onMove, onPlace, onIndent, tickOnly, areaOf = () => null, folded = [], onFold }) => {
  const tools = ordering && !tickOnly;
  const info = outline ? outlineInfo(items) : {};
  const hidden = (item) => outline && info[item.id]?.child && folded.includes(info[item.id].parent);
  // Indenting under a folded group opens it so the item doesn't vanish.
  const indent = (id, v) => {
    const i = items.findIndex((x) => x.id === id);
    if (v && i > 0) onFold?.(info[items[i - 1].id].parent, false);
    onIndent(id, v);
  };
  return (
    <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="checklist">
      {items.length === 0 && (
        <li className="flex items-center justify-between gap-3 p-4 text-sm font-medium text-[var(--muted)]" data-testid="checklist-empty">
          <span>{tickOnly ? "No items on this list yet." : "No items yet. Add your first task below."}</span>
          {!tickOnly && <button type="button" className="icon-btn shrink-0 hover:text-[var(--red)]" aria-label="Delete this list" title="Delete this list"
            onClick={onDeleteList} data-testid="delete-list-btn"><Trash2 className="h-[18px] w-[18px]" /></button>}
        </li>
      )}
      {items.filter((item) => !hidden(item)).map((item) => {
        const inf = info[item.id];
        return (
          <Row key={item.id} item={item} info={inf} text={labelFor(item)} emergency={emergency} tickOnly={tickOnly} area={areaOf(item)}
            fold={inf?.subs > 0 && onFold ? { folded: folded.includes(item.id), onFold: (f) => onFold(item.id, f) } : null}
            onToggle={() => onToggle(item.id)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)}
            number={tools && inf && <OrderNumber key={`${item.id}-${inf.num}`} id={item.id} pos={inf.pos} label={inf.num} total={inf.total} onPlace={(n) => onPlace(item.id, n)} />}
            tools={tools && inf && <PriorityTools item={item} info={inf} onFlag={() => onFlag(item.id)} onMove={(d) => onMove(item.id, d)} onIndent={(v) => indent(item.id, v)} />} />
        );
      })}
    </ul>
  );
};
