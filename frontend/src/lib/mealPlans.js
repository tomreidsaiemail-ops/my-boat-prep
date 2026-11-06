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

// The cook for a meal sits at the end of its heading: "1. Day 1 Dinner: Curry (Cook: Jane)".
export const COOK_RE = /\s*\(Cook:\s*([^)]*)\)\s*$/i;
export const cookOf = (label) => (String(label || "").match(COOK_RE)?.[1] || "").trim();
export const withCook = (label, cook) => `${String(label || "").replace(COOK_RE, "")}${cook ? ` (Cook: ${cook})` : ""}`;

const RECIPE = /^\s*\[.*\]\s*$/s;
export const cooksRota = (lists, data) => {
  const by = new Map();
  lists.forEach((l) => (data[l.id] || []).forEach((it, k, arr) => {
    const cook = !it.indent && arr[k + 1]?.indent && RECIPE.test(arr[k + 1].label || "") ? cookOf(it.label) : "";
    if (!cook) return;
    const key = cook.toLowerCase();
    if (!by.has(key)) by.set(key, { cook, meals: [] });
    by.get(key).meals.push({ id: `${l.id}-${it.id}`, list: l.name, day: Number(it.label.match(/\bDay\s+(\d+)/i)?.[1] || 0), done: !!it.checked,
      meal: it.label.replace(COOK_RE, "").replace(/^\s*\d+[.)]\s*/, "") });
  }));
  return [...by.values()].map((c) => ({ ...c, meals: c.meals.sort((a, b) => (a.day || 999) - (b.day || 999)) }));
};

// Breakfast, Lunch or Dinner group for a meal, guessed from its name.
const GUESS = [
  ["breakfast", /\b(breakfast|brekkie|brunch|eggs?|porridge|oats|cereal|muesli|granola|pancakes?|omelett?e|bacon|toast|croissants?|yogh?urt|smoothie|butties)\b/i],
  ["lunch", /\b(lunch|wraps?|sandwich(es)?|salad|soup|rolls?|toasties?|panini|quesadillas?|bagels?|burritos?|nachos)\b/i],
  ["dinner", /\b(dinner|supper|curry|chilli|bolognese|pasta|spaghetti|stew|roast|risotto|stir[- ]?fry|pie|steak|fish|chicken|lasagne|casserole|tagine|burgers?|sausages?|paella|noodles?)\b/i],
];
export const MEAL_GROUPS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["any", "Any time"]];
export const mealGroup = (meal) => (meal.meal_type && MEAL_GROUPS.some(([k]) => k === meal.meal_type) ? meal.meal_type
  : (GUESS.find(([, re]) => re.test(meal.name || "")) || ["any"])[0]);

