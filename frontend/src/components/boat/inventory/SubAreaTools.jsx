import { FolderInput, FolderOutput, FolderPlus } from "lucide-react";

// Folders and boxes (sub-areas) live inside a cupboard; these buttons add one, put a whole area inside another, or take one back out.
export const SubAreaTools = ({ area, sub, parentName, canMerge, onAddSub, onMerge, onTakeOut, coach = false }) => (
  <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-3 py-2" data-testid={`inventory-sub-tools-${area.id}`}>
    {!sub && (
      <button type="button" className="btn-ghost h-10 px-3 text-sm" onClick={onAddSub} data-testid={`inventory-add-sub-${area.id}`}>
        <FolderPlus className="h-4 w-4" /> Add a folder or box
      </button>
    )}
    {!sub && coach && <p className="basis-full rounded-md bg-yellow-200 px-2.5 py-2 text-sm font-bold text-[var(--navy)]" data-testid={`inventory-add-sub-coach-${area.id}`}>This is where you can scan that group of manuals or your folder of rigging and boat builders reports.</p>}
    {!sub && canMerge && (
      <button type="button" className="btn-ghost h-10 px-3 text-sm" onClick={onMerge} data-testid={`inventory-merge-${area.id}`}>
        <FolderInput className="h-4 w-4" /> Put inside another cupboard
      </button>
    )}
    {sub && (
      <button type="button" className="btn-ghost h-10 px-3 text-sm" onClick={onTakeOut} data-testid={`inventory-takeout-${area.id}`}>
        <FolderOutput className="h-4 w-4" /> Take out of {parentName}
      </button>
    )}
  </div>
);
