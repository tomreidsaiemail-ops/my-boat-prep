import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Film, Pencil, Trash2, Youtube } from "lucide-react";

const Thumb = ({ src, kind }) => {
  const [failed, setFailed] = useState(false);
  const Icon = kind === "movies" ? Film : Youtube;
  const box = kind === "movies" ? "h-20 w-14 rounded-md" : "h-14 w-14 rounded-full";
  if (!src || failed) {
    return (
      <span className={`${box} flex shrink-0 items-center justify-center bg-[var(--navy)] text-white`} data-testid="media-thumb-default">
        <Icon className="h-6 w-6" />
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
    className={`${box} shrink-0 border border-[var(--line)] bg-slate-100 object-cover`} data-testid="media-thumb-img" />;
};

export const MediaRow = ({ item, kind, admin, arrows = admin, first, last, busy, onEdit, onDelete, onMove }) => (
  <li className="checklist-row flex-col" data-testid={`media-item-${item.id}`}>
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-[64px] w-full items-center gap-3 px-3 py-3 hover:bg-[var(--panel)] [transition:background-color_.15s]" data-testid={`media-link-${item.id}`}>
      <Thumb src={item.thumbnail} kind={kind} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="item-text font-bold" data-testid={`media-name-${item.id}`}>{item.name}</span>
        {item.note && <span className="text-sm text-[var(--muted)]" data-testid={`media-note-${item.id}`}>{item.note}</span>}
      </span>
      <ExternalLink className="h-5 w-5 shrink-0 text-[var(--muted)] group-hover:translate-x-0.5 [transition:transform_.15s]" />
    </a>
    {admin && (
      <div className="-mt-2 flex items-center gap-1 pb-2 pl-3" data-testid={`media-tools-${item.id}`}>
        {arrows && <>
          <button type="button" className="prio-btn" disabled={first || busy} onClick={() => onMove(-1)} aria-label="Move up" data-testid={`media-up-${item.id}`}><ArrowUp className="h-5 w-5" /></button>
          <button type="button" className="prio-btn" disabled={last || busy} onClick={() => onMove(1)} aria-label="Move down" data-testid={`media-down-${item.id}`}><ArrowDown className="h-5 w-5" /></button>
        </>}
        <button type="button" className="icon-btn" disabled={busy} onClick={onEdit} aria-label="Edit" data-testid={`media-edit-${item.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
        <button type="button" className="icon-btn hover:text-[var(--red)]" disabled={busy} onClick={onDelete} aria-label="Delete" data-testid={`media-delete-${item.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>
    )}
  </li>
);
