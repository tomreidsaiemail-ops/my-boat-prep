import { useState } from "react";
import { ArrowDown, ArrowLeftToLine, ArrowRightToLine, ArrowUp, Check, CheckCircle2, ChevronDown, ChevronRight, Flag, MapPin, Pencil, Trash2 } from "lucide-react";
import { ClampText, ExpandButton } from "@/components/boat/shipslog/ClampText";
import { OrderNumber } from "@/components/boat/OrderNumber";
import { outlineInfo } from "@/lib/outline";
import { MpaText } from "@/components/boat/MpaBadges";
import { MealTypeBadge } from "@/components/boat/MealTypePicker";
import { isMealHead } from "@/lib/mpa";
import { ItemPhoto } from "@/components/boat/ItemPhoto";
import { MmdLogAnswer } from "@/components/boat/doctor/MmdLogAnswer";
import { LogPhotos } from "@/components/boat/navigator/LogPhotos";

export const PriorityTools = ({ item, info, onFlag, onMove, onIndent }) => (
  <div className="flex flex-wrap items-center gap-1 pb-2 pl-1" data-testid={`priority-tools-${item.id}`}>
    <button type="button" className={`prio-btn ${item.flagged ? "!text-[var(--red)]" : ""}`} onClick={onFlag} aria-pressed={!!item.flagged}
      aria-label={item.flagged ? "Remove flag" : "Flag as urgent"} title={item.flagged ? "Remove flag" : "Flag as urgent"} data-testid={`checklist-item-flag-${item.id}`}>
      <Flag className={`h-5 w-5 ${item.flagged ? "fill-current" : ""}`} />
    </button>
    <button type="button" className="prio-btn" onClick={() => onMove(-1)} disabled={!info.upOk} aria-label="Move up" data-testid={`checklist-item-up-${item.id}`}><ArrowUp className="h-5 w-5" /></button>
    <button type="button" className="prio-btn" onClick={() => onMove(1)} disabled={!info.downOk} aria-label="Move down" data-testid={`checklist-item-down-${item.id}`}><ArrowDown className="h-5 w-5" /></button>
    {info.canIndent && <button type="button" className="prio-btn gap-1 text-xs font-bold sm:!w-auto sm:px-2" onClick={() => onIndent(true)} aria-label="Indent right, under the item above" title="Indent right"
      data-testid={`checklist-item-indent-${item.id}`}><ArrowRightToLine className="h-5 w-5" /><span className="hidden sm:inline">Indent</span></button>}
    {info.canOutdent && <button type="button" className="prio-btn gap-1 text-xs font-bold sm:!w-auto sm:px-2" onClick={() => onIndent(false)} aria-label="Outdent left, one level out" title="Outdent left"
      data-testid={`checklist-item-unindent-${item.id}`}><ArrowLeftToLine className="h-5 w-5" /><span className="hidden sm:inline">Outdent</span></button>}
  </div>
);

const FoldButton = ({ id, folded, onFold }) => (
  <button type="button" className="icon-btn" onClick={() => onFold(!folded)} aria-expanded={!folded}
    aria-label={folded ? "Show sub-items" : "Fold sub-items"} title={folded ? "Show sub-items" : "Fold sub-items"} data-testid={`checklist-item-fold-${id}`}>
    {folded ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
  </button>
);

const Row = ({ item, text, info, meal, onToggle, onEdit, onDelete, emergency, tools, number, tickOnly, area, fold, pick, photo, logPhotoUrl, depth = 0, clamp }) => {
  const [long, setLong] = useState(false);
  const open = !!clamp?.open.includes(item.id);
  const expand = clamp && long ? <ExpandButton id={item.id} open={open} onToggle={() => clamp.toggle(item.id)} /> : null;
  return (
  <li className={`checklist-row flex-wrap ${pick ? "is-pick" : ""} ${item.checked ? "is-checked" : ""} ${item.flagged ? "is-flagged" : ""} ${info?.shade ? "is-shaded" : ""} ${info?.child ? "is-child" : ""}`}
    data-testid={`checklist-item-${item.id}`} data-shaded={info?.shade ? "true" : "false"} data-indented={info?.child ? "true" : "false"}>
    {depth > 0 && <div className="shrink-0 border-r-2 border-sky-200" style={{ width: depth * 18 }} aria-hidden="true" data-testid={`checklist-item-depth-${item.id}`} />}
    {info?.child && <div className="shrink-0 [width:calc(var(--lvl)*1rem)] sm:[width:calc(var(--lvl)*1.75rem)]" style={{ "--lvl": info.depth || 1 }} aria-hidden="true" data-testid={`checklist-item-level-${item.id}`} data-level={info.depth || 1} />}
    {number && <div className="shrink-0 pl-2 pt-3">{number}</div>}
    <div className="flex min-w-0 flex-1 flex-col">
      <button type="button" role="checkbox" aria-checked={item.checked} onClick={onToggle} data-testid={`checklist-item-toggle-${item.id}`}
        className={`flex min-h-[56px] flex-1 items-start gap-3 py-3 text-left ${number ? "pl-2" : "pl-3"}`}>
        <span className={`tick-box ${emergency ? `tick-${emergency}` : ""}`}>{item.checked && <Check className="h-5 w-5" strokeWidth={3.5} />}</span>
        <span className="flex min-w-0 flex-col items-start gap-1 pt-0.5">
          <ClampText on={!!clamp} open={open} onLong={setLong} title={typeof text === "string" ? text : undefined}
            className={`item-text ${emergency ? "text-[17px] font-semibold" : ""}`} testId={`checklist-item-text-${item.id}`}><MpaText item={item} text={text} /></ClampText>
          {item.checked && !pick && <span className="tick-badge" data-testid={`checklist-item-ticked-${item.id}`}><CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} /> Done</span>}
          {area && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-900" data-testid={`checklist-item-area-${item.id}`}><MapPin className="h-3 w-3" />{area}</span>}
          {meal && <MealTypeBadge id={item.id} type={item.meal_type} />}
          {fold?.folded && <span className="text-xs font-bold text-sky-900" data-testid={`checklist-item-fold-summary-${item.id}`}>{info.subs} sub-item{info.subs === 1 ? "" : "s"} · {info.subsTicked} ticked</span>}
        </span>
      </button>
      {tools}
    </div>
    {fold && <div className="flex shrink-0 items-start pt-2"><FoldButton id={item.id} folded={fold.folded} onFold={fold.onFold} /></div>}
    {tickOnly && (photo || expand) && <div className={`flex shrink-0 items-center pr-2 ${expand ? "self-start pt-2" : "self-center"}`}>{expand}{photo}</div>}
    {!tickOnly && <div className="flex shrink-0 items-center pr-1">
      {expand}
      {photo}
      <button type="button" className="icon-btn" aria-label="Edit item" onClick={onEdit} data-testid={`checklist-item-edit-${item.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
      <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Delete item" onClick={onDelete} data-testid={`checklist-item-delete-${item.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
    </div>}
    {item.mmd_answer && <MmdLogAnswer id={item.id} answer={item.mmd_answer} />}
    {item.detail && <MmdLogAnswer id={item.id} answer={item.detail} kind="depart" />}
    {logPhotoUrl && item.weather_photos?.length > 0 && <LogPhotos id={item.id} photos={item.weather_photos} urlFor={logPhotoUrl} />}
  </li>
  );
};

// `outline` is off while an area filter shows only part of the list, so groups and numbers would be misleading.
export const Checklist = ({ items, labelFor, onToggle, onTickAll, onEdit, onDelete, onDeleteList, emergency, ordering, outline = true, onFlag, onMove, onPlace, onIndent, tickOnly, areaOf = () => null, folded = [], onFold, picks = false, photos = null, logPhotoUrl, depthOf, folderRow, clamp, onPlacePath }) => {
  const tools = ordering && !tickOnly;
  const info = outline ? outlineInfo(items) : {};
  const hidden = (item) => outline && info[item.id]?.ancestors?.some((a) => folded.includes(a));
  // Indenting under a folded item opens it so the item doesn't vanish.
  const indent = (id, v) => {
    if (v && info[id]?.prevSib) onFold?.(info[id].prevSib, false);
    onIndent(id, v);
  };
  return (
    <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="checklist">
      {onTickAll && items.length > 0 && (
        <li className="border-b-[1.5px] border-[var(--line)] bg-slate-50">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 text-sm font-bold" data-testid="checklist-select-all-label">
            <input type="checkbox" checked={items.every((i) => i.checked)} onChange={(e) => onTickAll(e.target.checked)} className="h-5 w-5 accent-[var(--navy)]" data-testid="checklist-select-all" />
            Select All <span className="font-medium text-[var(--muted)]" data-testid="checklist-select-all-count">({items.filter((i) => i.checked).length} of {items.length} ticked)</span>
          </label>
        </li>
      )}
      {items.length === 0 && (
        <li className="flex items-center justify-between gap-3 p-4 text-sm font-medium text-[var(--muted)]" data-testid="checklist-empty">
          <span>{tickOnly ? "No items on this list yet." : "No items yet. Add your first task below."}</span>
          {!tickOnly && <button type="button" className="icon-btn shrink-0 hover:text-[var(--red)]" aria-label="Delete this list" title="Delete this list"
            onClick={onDeleteList} data-testid="delete-list-btn"><Trash2 className="h-[18px] w-[18px]" /></button>}
        </li>
      )}
      {items.filter((item) => !hidden(item)).map((item) => {
        const inf = info[item.id];
        if (item.folder && folderRow) return folderRow(item);
        return (
          <Row key={item.id} item={item} clamp={clamp} depth={depthOf ? depthOf(item.id) : 0} pick={picks} logPhotoUrl={logPhotoUrl} info={inf} meal={!!item.meal_type && isMealHead(items, item.id)} text={labelFor(item)} emergency={emergency} tickOnly={tickOnly} area={areaOf(item)}
            fold={inf?.subs > 0 && onFold ? { folded: folded.includes(item.id), onFold: (f) => onFold(item.id, f) } : null}
            onToggle={() => onToggle(item.id)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)}
            photo={photos && (item.photo_id || item.after_id || photos.canEdit) && <ItemPhoto item={item} name={labelFor(item)} photos={photos} />}
            number={tools && inf && <OrderNumber key={`${item.id}-${inf.num}`} id={item.id} pos={inf.pos} label={inf.num} total={inf.total} onPlace={(n) => onPlace(item.id, n)}
              onPath={onPlacePath ? (p) => onPlacePath(item.id, p) : undefined} />}
            tools={tools && inf && <PriorityTools item={item} info={inf} onFlag={() => onFlag(item.id)} onMove={(d) => onMove(item.id, d)} onIndent={(v) => indent(item.id, v)} />} />
        );
      })}
    </ul>
  );
};
