import { useEffect, useState } from "react";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";

// Delete a cupboard or box, or (ticked) just the items in it, leaving it empty. A cupboard's folders and boxes are kept.
export const DeleteAreaDialog = ({ area, subs = 0, onDelete, onEmpty, onClose }) => {
  const [only, setOnly] = useState(false);
  useEffect(() => { setOnly(false); }, [area?.id]);
  const count = area?.items?.length || 0;
  const box = !!area?.parent_id;
  const kind = box ? "box" : "cupboard";
  const items = `${count} contained ${count === 1 ? "Item" : "Items"}`;
  const keeps = box ? `The ${kind} stays, empty.` : `The ${kind} stays, empty${subs ? `, and its ${subs === 1 ? "folder or box is kept with its" : `${subs} folders and boxes are kept with their`} own items` : ""}.`;
  return (
    <ConfirmDelete item={area} testId="inventory-area-delete" title={only ? <>Delete the items in &quot;{area?.name}&quot;?</> : undefined}
      note={only ? `The ${items.toLowerCase()} ${count === 1 ? "is" : "are"} removed.`
        : `Everything listed inside it${subs ? ", including its folders and boxes," : ""} is removed too, and checklist items tagged with it lose their tag.`}
      confirmLabel={only ? `Delete the ${items}` : "Delete"} onClose={onClose} onConfirm={only ? onEmpty : onDelete}
      body={count > 0 && (
        <label className="flex cursor-pointer items-start gap-2 rounded-md border-[1.5px] border-[var(--line)] px-3 py-2 text-sm" data-testid="inventory-area-delete-items-only">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" checked={only} onChange={(e) => setOnly(e.target.checked)} data-testid="inventory-area-delete-items-only-checkbox" />
          <span><b>Delete items contained</b> only. {keeps}</span>
        </label>
      )} />
  );
};
