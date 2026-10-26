import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { outlineInfo } from "@/lib/outline";

// One tap to fold or open every group; only shows on lists that have groups.
export const FoldAllButton = ({ items, folded, onFoldAll }) => {
  const info = outlineInfo(items);
  const parents = items.filter((i) => info[i.id]?.subs > 0).map((i) => i.id);
  if (!parents.length) return null;
  const allFolded = parents.every((id) => folded.includes(id));
  return (
    <button type="button" className="btn-ghost h-10 self-end px-3 text-sm" onClick={() => onFoldAll(allFolded ? [] : parents)}
      aria-pressed={allFolded} data-testid="fold-all-btn">
      {allFolded ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
      {allFolded ? "Unfold all groups" : `Fold all groups (${parents.length})`}
    </button>
  );
};
