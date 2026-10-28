import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { buildShopping, foodStock, initialsFor, keyOf } from "@/lib/mpa";
import { FoodBadge, SourceTag } from "@/components/boat/MpaBadges";

const Fact = ({ label, value, testId, warn }) => (
  <div className={`rounded-md border-[1.5px] px-3 py-2 ${warn ? "border-amber-400 bg-amber-50" : "border-[var(--line)]"}`} data-testid={testId}>
    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</p>
    <p className="text-sm font-bold">{value}</p>
  </div>
);

export const MpaDialog = ({ open, lists, boat, areas, provisions, online, onClose, onCreate }) => {
  const [picked, setPicked] = useState([]);
  const [useProv, setUseProv] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setPicked(lists.length === 1 ? [lists[0].id] : []); setUseProv(provisions.length > 0); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const tags = useMemo(() => Object.fromEntries(lists.map((l, i) => [l.id, initialsFor(lists.map((x) => x.name))[i]])), [lists]);
  const pob = boat.pob || 1;
  const children = Math.min(boat.children || 0, pob - 1);
  const adults = pob - children;
  const days = boat.trip_days || 0;
  const food = areas.filter((a) => a.food);
  const stock = useMemo(() => foodStock(areas), [areas]);
  const chosen = lists.filter((l) => picked.includes(l.id));
  const mealCount = chosen.reduce((n, l) => n + l.meals.length, 0);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const make = async () => {
    if (!chosen.length) { toast.error("Pick at least one meal plan list"); return; }
    setBusy(true);
    let amounts = {};
    const prov = useProv ? provisions : [];
    if (prov.length) {
      if (!online) toast.warning("No signal, so provisions are added without amounts");
      else {
        try {
          const onBoard = Object.fromEntries(prov.map((p) => [p, stock[keyOf(p)]?.qty]).filter(([, q]) => q));
          amounts = (await api.post("/ai/mpa/provisions", { items: prov, on_board: onBoard, adults, children, days: days || 1 }, { timeout: 90000 })).data.amounts;
        } catch (e) { toast.warning(apiError(e, "The Magic Mariner couldn't size the provisions, so they're added without amounts")); }
      }
    }
    const items = buildShopping({ lists: chosen.map((l) => ({ ...l, tag: tags[l.id] })), adults, children, days: days || 1, stock, provisions: prov, amounts });
    setBusy(false);
    onCreate(items);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" data-testid="mpa-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><Sparkles className="h-5 w-5" /> Marine Magic Provisioning</DialogTitle>
          <DialogDescription>Pick your meal plans. The MPA works out one shopping list for everyone on board, takes off what's already in your Food areas and adds your Provisions.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <p className="field-label">Meal plans</p>
          {lists.length === 0 && <p className="rounded-md bg-amber-50 p-3 text-sm" data-testid="mpa-no-lists">No meal plan lists yet. Make a list with numbered meal names (e.g. "1. Curry") so the lines underneath are indented. Put the recipe in brackets as the first line under each meal, then the ingredients, e.g. "200g rice".</p>}
          {lists.map((l) => (
            <label key={l.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border-[1.5px] border-[var(--line)] px-3" data-testid={`mpa-list-${l.id}`}>
              <input type="checkbox" className="h-5 w-5 accent-[var(--navy)]" checked={picked.includes(l.id)} onChange={() => toggle(l.id)} data-testid={`mpa-list-check-${l.id}`} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{l.name}</span>
              <span className="text-xs text-[var(--muted)]">{l.meals.length} {l.meals.length === 1 ? "meal" : "meals"}</span>
              <SourceTag tag={tags[l.id]} />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Fact label="On board" value={`${adults} ${adults === 1 ? "adult" : "adults"}${children ? `, ${children} ${children === 1 ? "child" : "children"}` : ""}`} testId="mpa-pob" />
          <Fact label="Trip duration" value={days ? `${days} ${days === 1 ? "day" : "days"}` : "Not set, using 1 day"} warn={!days} testId="mpa-days" />
        </div>
        <p className="flex items-center gap-2 text-sm" data-testid="mpa-food-areas">
          <FoodBadge />
          {food.length ? `${food.length} Food ${food.length === 1 ? "area" : "areas"} checked for stock on board` : "No Food areas flagged yet, so nothing is taken off for stock on board"}
        </p>
        {provisions.length > 0 && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-bold" data-testid="mpa-provisions">
            <input type="checkbox" className="h-5 w-5 accent-[var(--navy)]" checked={useProv} onChange={(e) => setUseProv(e.target.checked)} data-testid="mpa-provisions-check" />
            Add my Provisions list ({provisions.length}) with suggested amounts
          </label>
        )}
        <p className="text-xs text-[var(--muted)]">Amounts in recipes are for one adult; a child counts as half. Each meal is cooked once. Change people or trip days in Additional boat details.</p>
        <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={busy || !chosen.length} onClick={make} data-testid="mpa-make-btn">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Working out your shopping..." : `Make shopping list${mealCount ? ` (${mealCount} ${mealCount === 1 ? "meal" : "meals"})` : ""}`}
        </button>
      </DialogContent>
    </Dialog>
  );
};
