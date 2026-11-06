import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { useCrewDiet } from "@/lib/crewDiet";
import { DietBanner } from "@/components/boat/register/DietBanner";
import { MagicProvisionerIcon } from "@/components/boat/meals/MagicProvisionerIcon";
import { magicMealName, uniqueName } from "@/lib/mealPlans";

const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"]];
const AMOUNTS = [["under", "Under provision"], ["normal", "Normal"], ["over", "Over provision"]];

// Names of everything in the Food (F) boat areas and the folders inside them.
const onBoardFood = (areas) => {
  const food = new Set(areas.filter((a) => a.food).map((a) => a.id));
  return [...new Set(areas.filter((a) => food.has(a.id) || food.has(a.parent_id)).flatMap((a) => (a.items || []).filter((i) => !i.removed).map((i) => i.name)))].slice(0, 200);
};

const Setup = ({ mode, form, set, boatDays, foodCount }) => (
  <div className="flex flex-col gap-3">
    <label className="flex flex-col gap-1 text-sm font-bold">Trip days
      <input type="number" min={1} max={60} value={form.days} onChange={(e) => set({ days: e.target.value })} className="field-input w-28" data-testid="magic-meals-days-input" />
      <span className="text-xs font-normal text-[var(--muted)]">{boatDays ? `Trip days entered in Additional boat details: ${boatDays}` : "No trip days entered in Additional boat details yet"}</span>
    </label>
    <div className="flex flex-wrap gap-3" data-testid="magic-meals-types">
      {MEALS.map(([k, label]) => (
        <label key={k} className="flex min-h-[40px] items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="h-5 w-5 accent-[var(--navy)]" checked={form.meals.includes(k)} data-testid={`magic-meals-type-${k}`}
            onChange={(e) => set({ meals: e.target.checked ? [...form.meals, k] : form.meals.filter((x) => x !== k) })} />{label}
        </label>
      ))}
    </div>
    <div className="flex flex-col gap-1" role="radiogroup" aria-label="How much to provision">
      <span className="text-sm font-bold">How much to provision</span>
      <div className="grid grid-cols-3 gap-1">
        {AMOUNTS.map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={form.provisioning === k} onClick={() => set({ provisioning: k })} data-testid={`magic-meals-amount-${k}`}
            className={`min-h-[44px] rounded-md border-2 px-1 text-xs font-bold ${form.provisioning === k ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--navy)]"}`}>{label}</button>
        ))}
      </div>
    </div>
    <input value={form.note} onChange={(e) => set({ note: e.target.value })} maxLength={300} placeholder={'Optional note, e.g. "Thai, easy one-pot"'} className="field-input font-normal" data-testid="magic-meals-note-input" />
    {mode === "onboard" && <p className="text-sm" data-testid="magic-meals-food-count">{foodCount ? `${foodCount} foods from your Food (F) boat areas will be used first.` : "No food found in your Food (F) boat areas yet, so the plan will mostly need shopping."}</p>}
  </div>
);

const Preview = ({ meals, cooks, onCook, name, setName }) => (
  <div className="flex flex-col gap-2">
    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="field-input" aria-label="Meal plan name" data-testid="magic-meals-name-input" />
    <ul className="flex flex-col gap-2" data-testid="magic-meals-preview">
      {meals.map((m, k) => (
        <li key={k} className="rounded-md border-[1.5px] border-[var(--line)] p-2" data-testid={`magic-meals-row-${k}`}>
          <p className="text-sm font-bold">{magicMealName({ ...m, cook: "" })}</p>
          <p className="text-xs text-[var(--muted)]">{m.ingredients.length} ingredients</p>
          <label className="mt-1 flex items-center gap-2 text-xs font-bold">Prep and cook
            <select value={m.cook || ""} onChange={(e) => onCook(k, e.target.value)} className="field-input h-9 flex-1 text-sm" data-testid={`magic-meals-cook-${k}`}>
              <option value="">Not assigned</option>
              {cooks.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </li>
      ))}
    </ul>
  </div>
);

export const MagicMealPlanDialog = ({ mode, boat, areas, cooks = [], allNames, params, online, onCreate, onClose }) => {
  const diet = useCrewDiet()?.text || "";
  const [form, setForm] = useState({ days: boat.trip_days || 3, meals: ["breakfast", "lunch", "dinner"], provisioning: "normal", note: "" });
  const [meals, setMeals] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMeals(null); }, [mode]);
  const food = onBoardFood(areas);
  const pob = boat.pob || 1;
  const children = Math.min(boat.children || 0, pob - 1);
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const make = async () => {
    const days = Math.max(1, Math.min(60, parseInt(form.days, 10) || 1));
    if (!form.meals.length) { toast.error("Pick at least one of breakfast, lunch or dinner"); return; }
    if (!online) { toast.error("The Magic Provisioner needs a signal"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/ai/mpa/meal-plan", { mode, days, meals: form.meals, adults: pob - children, children, provisioning: form.provisioning, note: form.note, diet, on_board: mode === "onboard" ? food : [] }, { params, timeout: 120000 });
      setMeals(data.meals);
      setName(uniqueName(mode === "onboard" ? "Meal Plan From What's Onboard" : "Magic Meal Plan", allNames));
    } catch (e) { toast.error(apiError(e, "The Magic Provisioner couldn't plan the meals right now. Please try again.")); } finally { setBusy(false); }
  };
  const create = () => { if (!name.trim()) { toast.error("Name your meal plan"); return; } onCreate(name.trim(), meals); };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="magic-meals-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><MagicProvisionerIcon className="h-6 w-6" /> Magic Provisioner</DialogTitle>
          <DialogDescription>{mode === "onboard" ? "A meal plan built from what is onboard" : "A fresh meal plan"} for {pob} on board, with crew diets and allergies taken into account.</DialogDescription>
        </DialogHeader>
        <DietBanner testId="magic-meals-diet-banner" />
        {meals ? <Preview meals={meals} cooks={cooks} name={name} setName={setName} onCook={(k, c) => setMeals((ms) => ms.map((m, j) => (j === k ? { ...m, cook: c } : m)))} />
          : <Setup mode={mode} form={form} set={set} boatDays={boat.trip_days} foodCount={food.length} />}
        {meals ? (
          <div className="flex flex-col gap-2">
            <button type="button" className="btn-solid h-12 justify-center" onClick={create} data-testid="magic-meals-create-btn">Create meal plan ({meals.length} meals)</button>
            <button type="button" className="btn-ghost h-11 justify-center" onClick={() => setMeals(null)} data-testid="magic-meals-back-btn">Back</button>
          </div>
        ) : (
          <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={busy} onClick={make} data-testid="magic-meals-make-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MagicProvisionerIcon className="h-5 w-5" />}{busy ? "Planning your meals..." : "Plan the meals"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};
