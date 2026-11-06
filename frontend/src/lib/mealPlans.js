// Meal plan lines: "1. Meal" heading, an indented [recipe] line, then one indented line per ingredient.
export const mealItems = (meal, n, baseId, extra = {}) => [
  { id: baseId, label: `${n}. ${meal.name}`, checked: false, ...(meal.meal_type ? { meal_type: meal.meal_type } : {}), ...extra },
  { id: baseId + 1, label: `[${meal.recipe || "Cook and serve"}]`, checked: false, indent: true },
  ...meal.ingredients.map((ing, k) => ({ id: baseId + 2 + k, label: ing, checked: false, indent: true })),
];

const TYPE = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export const magicMealName = (m) => `Day ${m.day} ${TYPE[m.meal_type] || ""}: ${m.name}${m.cook ? ` (Cook: ${m.cook})` : ""}`.replace(/\s+:/, ":");

export const planItems = (meals, startN = 1, baseId = Date.now()) => {
  let id = baseId;
  return meals.flatMap((m, k) => {
    const rows = mealItems(m, startN + k, id);
    id += rows.length + 1;
    return rows;
  });
};

export const uniqueName = (base, taken) => {
  const has = (n) => taken.some((t) => t.toLowerCase() === n.toLowerCase());
  if (!has(base)) return base;
  let k = 2;
  while (has(`${base} ${k}`)) k += 1;
  return `${base} ${k}`;
};
