import { MEAL_TYPES } from "@/lib/mpa";

export const MealTypePicker = ({ value, onChange }) => (
  <label className="flex flex-col gap-1" data-testid="meal-type-picker">
    <span className="field-label">Meal type</span>
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="field-input" data-testid="meal-type-select">
      <option value="">Not set (read from the name)</option>
      {MEAL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.one}</option>)}
    </select>
  </label>
);

export const MealTypeBadge = ({ id, type }) => {
  const t = MEAL_TYPES.find((x) => x.id === type);
  return t ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900" data-testid={`checklist-item-meal-type-${id}`}>{t.one}</span> : null;
};
