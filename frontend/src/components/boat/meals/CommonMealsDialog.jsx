import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { parseMeals } from "@/lib/mpa";
import { MEAL_GROUPS, mealGroup, uniqueName } from "@/lib/mealPlans";

const NEW = "__new";
const COMMON_KEY = "mbp_common_meals";
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

const Bubble = ({ meal, added, mine, onPick, onRemove }) => (
  <span className={`inline-flex items-center rounded-full border-[1.5px] text-sm font-bold ${added ? "border-emerald-700 bg-emerald-50 text-emerald-900" : mine ? "border-[var(--blue)] bg-sky-50 text-[var(--navy)]" : "border-[var(--navy)] bg-white text-[var(--navy)]"}`}>
    <button type="button" className="inline-flex min-h-[36px] items-center gap-1 px-3" onClick={() => onPick(meal)} disabled={added} aria-pressed={added} data-testid={`meal-bubble-${slug(meal.name)}`}>
      {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{meal.name}
    </button>
    {mine && onRemove && <button type="button" className="pr-2 text-[var(--muted)]" onClick={() => onRemove(meal)} aria-label={`Forget ${meal.name}`} data-testid={`meal-bubble-remove-${slug(meal.name)}`}><X className="h-3.5 w-3.5" /></button>}
  </span>
);

const Grouped = ({ meals, mine, test, inPlan, onPick, onRemove }) => (
  <div className="flex flex-col gap-2" data-testid={`${test}-bubbles`}>
    {MEAL_GROUPS.map(([k, label]) => {
      const group = meals.filter((m) => mealGroup(m) === k);
      return group.length > 0 && (
        <div key={k} data-testid={`${test}-group-${k}`}>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">{label}</p>
          <div className="flex flex-wrap gap-2">
            {group.map((m) => <Bubble key={m.id || m.name} meal={m} mine={mine} added={inPlan.has(m.name.toLowerCase())} onPick={onPick} onRemove={onRemove} />)}
          </div>
        </div>
      );
    })}
  </div>
);

const OwnMealForm = ({ onSave, busy }) => {
  const [name, setName] = useState("");
  const [recipe, setRecipe] = useState("");
  const [ing, setIng] = useState("");
  const [type, setType] = useState("");
  const save = async (e) => {
    e.preventDefault();
    const ingredients = ing.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!name.trim() || !ingredients.length) { toast.error("Add a meal name and at least one ingredient"); return; }
    if (await onSave({ name: name.trim(), recipe: recipe.trim(), ingredients, ...(type ? { meal_type: type } : {}) })) { setName(""); setRecipe(""); setIng(""); setType(""); }
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-md border-[1.5px] border-dashed border-[var(--line)] p-3" data-testid="own-meal-form">
      <p className="text-sm font-bold">Add your own meal (remembered on your account)</p>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Meal name, e.g. Nachos" className="field-input" data-testid="own-meal-name-input" />
      <select value={type} onChange={(e) => setType(e.target.value)} className="field-input font-normal" aria-label="Meal group" data-testid="own-meal-type-select">
        <option value="">Group: guess from the name</option>
        {MEAL_GROUPS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <input value={recipe} onChange={(e) => setRecipe(e.target.value)} maxLength={600} placeholder="Recipe, e.g. Bake chips with cheese for 10 min" className="field-input font-normal" data-testid="own-meal-recipe-input" />
      <textarea value={ing} onChange={(e) => setIng(e.target.value)} rows={3} placeholder={"Ingredients, one per line\n100g corn chips"} className="field-input !h-auto min-h-[5rem] py-2 font-normal" data-testid="own-meal-ingredients-input" />
      <button type="submit" className="btn-solid h-11 justify-center gap-2" disabled={busy} data-testid="own-meal-save-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save and add to the meal plan</button>
    </form>
  );
};

export const CommonMealsDialog = ({ open, lists, allNames, activeId, online, onAdd, onClose }) => {
  const [common, setCommon] = useState(() => { try { return JSON.parse(localStorage.getItem(COMMON_KEY)) || []; } catch { return []; } });
  const [mine, setMine] = useState([]);
  const [target, setTarget] = useState(NEW);
  const [newName, setNewName] = useState("");
  const [added, setAdded] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTarget(lists.some((l) => l.id === activeId) ? activeId : NEW);
    setNewName(uniqueName("My Meal Plan", allNames));
    setAdded([]);
    if (!online) return;
    api.get("/meals/common").then(({ data }) => { const m = parseMeals(data.items); setCommon(m); localStorage.setItem(COMMON_KEY, JSON.stringify(m)); }).catch(() => {});
    api.get("/me/meals").then(({ data }) => setMine(data.meals)).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const inPlan = new Set([...(lists.find((l) => l.id === target)?.meals || []).map((m) => m.name.toLowerCase()), ...added]);
  const pick = (meal) => {
    if (target === NEW && !newName.trim()) { toast.error("Name your new meal plan first"); return; }
    const g = mealGroup(meal);
    const id = onAdd(target === NEW ? { name: newName.trim() } : { id: target }, { ...meal, meal_type: g === "any" ? undefined : g });
    if (!id) return;
    setTarget(id);
    setAdded((a) => [...a, meal.name.toLowerCase()]);
  };
  const saveOwn = async (meal) => {
    if (!online) { toast.error("Saving your own meal needs a signal"); return false; }
    setBusy(true);
    try {
      const { data } = await api.post("/me/meals", meal);
      setMine((m) => [...m.filter((x) => x.name.toLowerCase() !== data.name.toLowerCase()), data]);
      pick(data);
      return true;
    } catch (e) { toast.error(apiError(e, "Couldn't save your meal")); return false; } finally { setBusy(false); }
  };
  const forget = (meal) => api.delete(`/me/meals/${meal.id}`).then(() => setMine((m) => m.filter((x) => x.id !== meal.id))).catch(() => toast.error("Couldn't remove that meal"));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="common-meals-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Create a Meal Plan</DialogTitle>
          <DialogDescription>Tap a meal to add it, with its recipe and ingredients, to your meal plan.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-sm font-bold">Add meals to
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="field-input" data-testid="common-meals-target-select">
            <option value={NEW}>A new meal plan</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        {target === NEW && <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="Meal plan name" className="field-input" data-testid="common-meals-new-name-input" />}
        <p className="field-label">Common meals</p>
        {common.length ? <Grouped meals={common} test="common-meals" inPlan={inPlan} onPick={pick} /> : <p className="text-sm text-[var(--muted)]" data-testid="common-meals-bubbles">No common meals yet.</p>}
        {mine.length > 0 && <>
          <p className="field-label">My meals</p>
          <Grouped meals={mine} mine test="my-meals" inPlan={inPlan} onPick={pick} onRemove={forget} />
        </>}
        <OwnMealForm onSave={saveOwn} busy={busy} />
        <button type="button" className="btn-ghost h-11 justify-center" onClick={onClose} data-testid="common-meals-done-btn">Done</button>
      </DialogContent>
    </Dialog>
  );
};
