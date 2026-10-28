// Built-in 7-day Meal Plan (3 meals a day). Format read by the MPA: meal name, then an indented
// [recipe] line, then indented ingredients. Amounts are for one adult.
const DAYS = [
  [
    ["Day 1 Breakfast: Porridge with banana and honey", "Simmer oats in milk for 5 minutes, top with sliced banana and honey", ["60g oats", "200 ml milk", "1 banana", "1 tbsp honey"]],
    ["Day 1 Lunch: Ham and cheese wraps", "Fill wraps with ham, cheese and salad, roll tightly", ["2 wraps", "50g ham", "40g cheese", "1 tomato", "30g lettuce"]],
    ["Day 1 Dinner: Spaghetti Bolognese", "Brown mince with onion and garlic, add tinned tomatoes, simmer 20 minutes, serve on spaghetti", ["120g spaghetti", "125g beef mince", "1/2 onion", "1 clove garlic", "1/2 can chopped tomatoes", "20g parmesan"]],
  ],
  [
    ["Day 2 Breakfast: Scrambled eggs on toast", "Whisk eggs with a splash of milk, stir gently in a buttered pan, serve on toast", ["2 eggs", "2 slices bread", "10g butter", "30 ml milk"]],
    ["Day 2 Lunch: Tuna pasta salad", "Mix cooked pasta with tuna, sweetcorn, mayo and chopped cucumber", ["80g pasta", "1/2 can tuna", "50g sweetcorn", "1 tbsp mayonnaise", "1/4 cucumber"]],
    ["Day 2 Dinner: Chicken curry with rice", "Fry onion and chicken, add curry paste and coconut milk, simmer 15 minutes, serve with rice", ["150g chicken thigh", "1/2 onion", "1 tbsp curry paste", "1/2 can coconut milk", "80g rice"]],
  ],
  [
    ["Day 3 Breakfast: Muesli with yoghurt and fruit", "Serve muesli with yoghurt and chopped apple", ["60g muesli", "150g yoghurt", "1 apple"]],
    ["Day 3 Lunch: Cheese and tomato toasties", "Fill bread with cheese and tomato, toast in a dry pan until golden", ["2 slices bread", "50g cheese", "1 tomato", "10g butter"]],
    ["Day 3 Dinner: Sausages, mash and peas", "Fry sausages, boil and mash potatoes with butter and milk, cook peas", ["3 sausages", "250g potatoes", "15g butter", "30 ml milk", "80g frozen peas"]],
  ],
  [
    ["Day 4 Breakfast: Bacon and egg rolls", "Fry bacon and eggs, serve in buttered rolls with sauce", ["2 bacon rashers", "1 egg", "1 bread roll", "1 tbsp tomato sauce"]],
    ["Day 4 Lunch: Chickpea and feta salad", "Toss chickpeas with tomato, cucumber, feta, olive oil and lemon", ["1/2 can chickpeas", "1 tomato", "1/4 cucumber", "40g feta", "1 tbsp olive oil", "1/2 lemon"]],
    ["Day 4 Dinner: Fish tacos", "Pan-fry fish with paprika, serve in tortillas with cabbage, lime and mayo", ["150g white fish", "2 tortillas", "60g cabbage", "1/2 lime", "1 tsp paprika", "1 tbsp mayonnaise"]],
  ],
  [
    ["Day 5 Breakfast: Pancakes with lemon and sugar", "Whisk flour, egg and milk, fry thin pancakes, serve with lemon and sugar", ["60g flour", "1 egg", "120 ml milk", "1/2 lemon", "1 tbsp sugar"]],
    ["Day 5 Lunch: Leftover curry wraps", "Warm any leftover curry or tinned beans, wrap with cheese and lettuce", ["2 wraps", "1/2 can baked beans", "30g cheese", "30g lettuce"]],
    ["Day 5 Dinner: One-pot chilli con carne", "Brown mince with onion, add kidney beans, tomatoes and chilli, simmer 20 minutes, serve with rice", ["125g beef mince", "1/2 onion", "1/2 can kidney beans", "1/2 can chopped tomatoes", "1 tsp chilli powder", "80g rice"]],
  ],
  [
    ["Day 6 Breakfast: Yoghurt, granola and berries", "Layer yoghurt with granola and berries", ["150g yoghurt", "50g granola", "80g berries"]],
    ["Day 6 Lunch: Soup and crusty bread", "Heat soup, serve with buttered crusty bread", ["1 can soup", "2 slices bread", "10g butter"]],
    ["Day 6 Dinner: Lamb steaks with potatoes and greens", "Season and pan-fry lamb, boil potatoes, steam green beans", ["150g lamb steak", "200g potatoes", "80g green beans", "1 tbsp olive oil"]],
  ],
  [
    ["Day 7 Breakfast: Eggs and beans on toast", "Fry eggs, heat beans, serve on toast", ["2 eggs", "1/2 can baked beans", "2 slices bread"]],
    ["Day 7 Lunch: Crackers, cheese and fruit platter", "Arrange crackers, cheese, salami and fruit", ["60g crackers", "50g cheese", "40g salami", "1 apple"]],
    ["Day 7 Dinner: Pasta with pesto and chicken", "Cook pasta, toss with pan-fried chicken, pesto and parmesan", ["120g pasta", "150g chicken breast", "2 tbsp pesto", "20g parmesan"]],
  ],
];

export const MEAL_PLAN_ITEMS = DAYS.flat().flatMap(([meal, recipe, ingredients], m) => [
  { label: `${m + 1}. ${meal}` },
  { label: `[${recipe}]`, indent: true },
  ...ingredients.map((label) => ({ label, indent: true })),
]);
