import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { applyMerge, changeKey, mergePlan } from "@/lib/merge";
import { MergeSummary } from "@/components/boat/merge/MergeSummary";
import { MergeChoices } from "@/components/boat/merge/MergeChoices";
import { MergeDiscard } from "@/components/boat/merge/MergeDiscard";

const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

// Fetches the master version this boat last synced, so master changes can be told apart from the skipper's own.
const useBase = (open, listId, syncedAt, online, fallback) => {
  const [state, setState] = useState({ loading: true, items: null });
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setState({ loading: true, items: null });
    if (!syncedAt || !online) { setState({ loading: false, items: syncedAt ? null : fallback }); return undefined; }
    api.get(`/templates/${listId}/version`, { params: { at: syncedAt } })
      .then(({ data }) => live && setState({ loading: false, items: data.items }))
      .catch(() => live && setState({ loading: false, items: null }));
    return () => { live = false; };
  }, [open, listId, syncedAt, online]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
};

export const MergeDialog = ({ open, list, local, master, masterAt, syncedAt, fallbackBase, online, onMerge, onTakeMaster, onKeepMine, onClose }) => {
  const base = useBase(open, list?.id, syncedAt, online, fallbackBase);
  const plan = useMemo(() => mergePlan(base.items, master, local), [base.items, master, local]);
  const [picked, setPicked] = useState(new Set());
  useEffect(() => { setPicked(new Set()); }, [open, base.items]);
  const toggle = (k, on) => setPicked((p) => { const n = new Set(p); if (on) n.add(k); else n.delete(k); return n; });
  const all = [...plan.add.map((i) => changeKey("add", i)), ...plan.remove.map((i) => changeKey("remove", i))];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="merge-dialog">
        <DialogHeader>
          <DialogTitle className="text-left font-display text-xl font-extrabold">Merge latest {list?.name}</DialogTitle>
          <DialogDescription className="text-left text-sm text-[var(--muted)]">Your {list?.name} is kept by default. Tick any master change you want to bring in.</DialogDescription>
        </DialogHeader>
        {base.loading ? (
          <p className="flex items-center gap-2 text-sm" data-testid="merge-loading"><Loader2 className="h-4 w-4 animate-spin" /> Comparing with the master...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <MergeSummary plan={plan} listName={list?.name} when={fmtDay(masterAt)} />
            <MergeChoices plan={plan} picked={picked} onToggle={toggle} allOn={all.length > 0 && all.every((k) => picked.has(k))}
              onAll={(on) => setPicked(new Set(on ? all : []))} />
            <button type="button" className="btn-solid h-12 justify-center" onClick={() => onMerge(applyMerge(local, master, plan, picked), picked.size)} data-testid="merge-confirm-btn">
              {picked.size ? `Merge ${picked.size} ${picked.size === 1 ? "change" : "changes"}` : `Keep my ${list?.name} as it is`}
            </button>
            <MergeDiscard listName={list?.name} onTakeMaster={onTakeMaster} onKeepMine={onKeepMine} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
