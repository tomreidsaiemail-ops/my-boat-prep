import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

const Pick = ({ id, checked, onChange, children, bold, testId }) => (
  <label htmlFor={id} className={`flex min-h-[44px] cursor-pointer items-start gap-3 py-2 ${bold ? "font-bold" : "pl-7 font-medium"}`}>
    <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5 h-5 w-5" data-testid={testId} />
    <span className="min-w-0 break-words text-[15px] leading-snug">{children}</span>
  </label>
);

// Ticking the category ticks every item; unticking any item keeps the category. Re-ticking items never re-ticks the category.
export const DeleteGroupDialog = ({ group, labelFor, onConfirm, onClose }) => {
  const [head, setHead] = useState(true);
  const [subs, setSubs] = useState([]);
  useEffect(() => { if (group) { setHead(true); setSubs(group.subs.map((s) => s.id)); } }, [group]);
  if (!group) return null;
  const toggleHead = (v) => { setHead(v); if (v) setSubs(group.subs.map((s) => s.id)); };
  const toggleSub = (id, v) => { setSubs((cur) => (v ? [...cur, id] : cur.filter((x) => x !== id))); if (!v) setHead(false); };
  const ids = head ? [group.head.id, ...group.subs.map((s) => s.id)] : subs;
  const kept = group.subs.length - subs.length;
  const note = head ? `The category and all ${group.subs.length} item${group.subs.length === 1 ? "" : "s"} will be deleted.`
    : `The category stays${kept ? ` with ${kept} item${kept === 1 ? "" : "s"}` : ""}. ${subs.length ? `${subs.length} item${subs.length === 1 ? "" : "s"} will be deleted.` : "Nothing is selected to delete."}`;
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="group-delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl font-extrabold">Delete category?</AlertDialogTitle>
          <AlertDialogDescription data-testid="group-delete-note">{note}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border-[1.5px] border-[var(--line)] px-3" data-testid="group-delete-list">
          <Pick id="gd-head" checked={head} onChange={toggleHead} bold testId="group-delete-head-checkbox">{labelFor(group.head)}</Pick>
          {group.subs.map((s) => (
            <Pick key={s.id} id={`gd-${s.id}`} checked={subs.includes(s.id)} onChange={(v) => toggleSub(s.id, v)} testId={`group-delete-item-checkbox-${s.id}`}>{labelFor(s)}</Pick>
          ))}
        </div>
        <AlertDialogFooter className="flex-row justify-end gap-2">
          <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="group-delete-cancel-btn">Keep</AlertDialogCancel>
          <button type="button" className="btn-solid bg-[var(--red)] px-5 disabled:opacity-50" disabled={!ids.length}
            onClick={() => onConfirm(ids)} data-testid="group-delete-confirm-btn">Delete{ids.length ? ` (${ids.length})` : ""}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
