import { useState } from "react";
import { ChevronDown, FolderClosed } from "lucide-react";

const Items = ({ items, testId }) => (
  <ul className="divide-y divide-[var(--line)]" data-testid={testId}>
    {items.map((i) => (
      <li key={i.id} className={`flex justify-between gap-2 px-3 py-2 text-sm ${i.removed ? "bg-red-100" : ""}`} data-testid={`walkthrough-item-${i.id}`}>
        <span className="font-semibold">{i.name}{i.removed && <span className="text-[var(--red)]"> (removed for now)</span>}</span>
        <span className="font-mono text-[var(--muted)]">x{i.qty}</span>
      </li>
    ))}
  </ul>
);

const Folder = ({ sub }) => {
  const [open, setOpen] = useState(false);
  const items = sub.items || [];
  return (
    <li className="border-t border-[var(--line)]" data-testid={`walkthrough-folder-${sub.id}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[var(--navy)]" data-testid={`walkthrough-folder-toggle-${sub.id}`}>
        <FolderClosed className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">{sub.name}</span>
        <span className="text-xs font-semibold text-[var(--muted)]">{items.length} {items.length === 1 ? "item" : "items"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (items.length ? <div className="bg-[var(--panel)]"><Items items={items} testId={`walkthrough-folder-items-${sub.id}`} /></div>
        : <p className="px-3 pb-2 text-sm text-[var(--muted)]">Nothing listed in here yet.</p>)}
    </li>
  );
};

// A cupboard's own items, then its folders and boxes (closed, tap to peek inside).
export const StopContents = ({ area, areas = [] }) => {
  if (!area) return <p className="text-sm text-[var(--muted)]" data-testid="walkthrough-not-listed">This spot isn't listed in Boat Inventory yet.</p>;
  const items = area.items || [];
  const subs = areas.filter((a) => a.parent_id === area.id);
  if (!items.length && !subs.length) return <p className="text-sm text-[var(--muted)]" data-testid="walkthrough-empty">Nothing listed in here yet.</p>;
  return (
    <div className="max-h-[34vh] overflow-y-auto rounded-md border border-[var(--line)]" data-testid="walkthrough-items">
      {items.length > 0 && <Items items={items} testId="walkthrough-own-items" />}
      {subs.length > 0 && (
        <>
          <p className="border-t border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide" data-testid="walkthrough-folders-title">Folders and boxes in here</p>
          <ul data-testid="walkthrough-folders">{subs.map((s) => <Folder key={s.id} sub={s} />)}</ul>
        </>
      )}
    </div>
  );
};
