import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { topUpOutline } from "@/lib/outline";

const Suggestion = ({ s, n, ticked, onTick }) => (
  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 text-sm" data-testid={`topup-suggestion-${n}`}>
    <input type="checkbox" checked={ticked} onChange={() => onTick(n)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`topup-tick-${n}`} />
    <span className="font-medium">{s.item}</span>
  </label>
);

const Groups = ({ suggestions, picked, onTick }) => {
  const heads = [...new Set(suggestions.map((s) => s.heading))];
  return heads.map((h) => (
    <div key={h || "_end"} className="rounded-md border-[1.5px] border-[var(--line)] bg-white">
      <p className="border-b border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide">{h ? `Under: ${h}` : "At the end of the list"}</p>
      {suggestions.map((s, n) => (s.heading === h ? <Suggestion key={n} s={s} n={n} ticked={picked.has(n)} onTick={onTick} /> : null))}
    </div>
  ));
};

export const TopUpDialog = ({ open, list, items, description, labelFor, onAdd, onClose }) => {
  const [state, setState] = useState({ busy: false, error: "", suggestions: [], left: null });
  const [picked, setPicked] = useState(new Set());
  useEffect(() => {
    if (!open) return;
    setState({ busy: true, error: "", suggestions: [], left: null });
    setPicked(new Set());
    const ctrl = new AbortController();
    api.post("/ai/list-topup", { name: list.name, description: description || "", items: topUpOutline(items, labelFor).slice(0, 400).map((i) => ({ ...i, label: i.label.slice(0, 300) })) }, { timeout: 90000, signal: ctrl.signal })
      .then(({ data }) => setState({ busy: false, error: "", suggestions: data.suggestions, left: data.drafts_left }))
      .catch((e) => !ctrl.signal.aborted && setState({ busy: false, error: apiError(e, "Magic List Top-Up couldn't do that right now. Please try again."), suggestions: [], left: null }));
    return () => ctrl.abort();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const tick = (n) => setPicked((p) => { const q = new Set(p); if (q.has(n)) q.delete(n); else q.add(n); return q; });
  const all = state.suggestions.length > 0 && picked.size === state.suggestions.length;
  const { busy, error, suggestions, left } = state;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col rounded-lg border-2 border-[var(--navy)]" data-testid="topup-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Magic List Top-Up</DialogTitle>
          <DialogDescription>Tick the suggestions you want to add to {list?.name}.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
          {busy && <p className="flex items-center gap-2 py-6 text-sm font-semibold" data-testid="topup-loading"><Loader2 className="h-5 w-5 animate-spin" /> Magic List Generation is finding missing items...</p>}
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="topup-error">{error}</p>}
          {!busy && !error && suggestions.length === 0 && <p className="py-4 text-sm" data-testid="topup-empty">No missing items found. This list looks complete.</p>}
          {suggestions.length > 0 && <>
            <button type="button" className="self-start text-sm font-bold underline" onClick={() => setPicked(all ? new Set() : new Set(suggestions.map((_, n) => n)))} data-testid="topup-tick-all-btn">{all ? "Untick all" : "Tick all"}</button>
            <Groups suggestions={suggestions} picked={picked} onTick={tick} />
          </>}
          {left !== null && <p className="text-xs text-[var(--muted)]" data-testid="topup-left">{left} Magic List Generations left today.</p>}
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <button type="button" className="btn-ghost px-5" onClick={onClose} data-testid="topup-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid px-5" disabled={!picked.size} data-testid="topup-add-btn"
            onClick={() => onAdd(suggestions.filter((_, n) => picked.has(n)))}>{picked.size ? `Add ${picked.size} ${picked.size === 1 ? "item" : "items"}` : "Add items"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const TopUpButton = ({ online, onClick }) => (
  <button type="button" onClick={onClick} disabled={!online} className="btn-ghost h-12 justify-center gap-2" data-testid="topup-btn"
    title={online ? "Suggest missing items with Magic List Generation" : "Magic List Top-Up needs a signal"}>
    <Sparkles className="h-4 w-4 shrink-0" /> {online ? "Magic List Top-Up" : "Magic List Top-Up needs a signal"}
  </button>
);
