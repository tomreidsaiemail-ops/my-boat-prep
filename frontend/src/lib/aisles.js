// Built-in supermarket aisle groups for the MPA shopping list.
const MATCH = [
  ["Herbs, spices & sauces", /\b(salt|black pepper|peppercorn|spice|curry|paprika|cumin|chilli flake|oregano|thyme|cinnamon|stock|bouillon|soy|sauce|ketchup|mustard|mayo|vinegar|oil|dressing|gravy)/],
  ["Tins & jars", /\b(tin|tinned|canned|jar|chopped tomato|soup|chickpea|baked bean|kidney bean|coconut milk|passata|tomato paste|tuna|sardine|pickle|olive|jam|honey|peanut butter|spread)/],
  ["Meat & fish", /\b(beef|mince|steak|lamb|pork|bacon|ham|sausage|chorizo|salami|chicken|turkey|fish|salmon|prawn|shrimp|mussel|meat)/],
  ["Dairy & eggs", /\b(milk|cream|butter|cheese|yoghurt|yogurt|eggs?\b|feta|parmesan|mozzarella)/],
  ["Fresh produce", /\b(apple|banana|orange|lemon|lime|pears?\b|grape|berr|melon|mango|avocado|tomato|potato|onion|garlic|ginger|carrot|celery|pepper|capsicum|chilli|chili|lettuce|salad|spinach|cabbage|broccoli|cauliflower|courgette|zucchini|cucumber|mushroom|peas?\b|corn\b|kumara|sweet potato|pumpkin|leek|herb|parsley|coriander|basil|mint|fruit|veg)/],
  ["Pantry & dry goods", /\b(pasta|spaghetti|penne|noodle|rice|couscous|quinoa|flour|sugar|oat|porridge|cereal|muesli|granola|cracker|biscuit|crisp|chips|nut|raisin|dried|coffee|tea\b|cocoa|chocolate|snack|lentil|beans?\b)/],
  ["Bakery", /\b(bread|loaf|loaves|rolls?\b|bun|wrap|tortilla|pita|bagel|croissant|muffin)/],
  ["Frozen", /\b(frozen|ice cream|ice\b)/],
  ["Drinks", /\b(water|juice|soda|cola|lemonade|beer|wine|cider|rum|gin\b|whisky|spirit|drink|squash|cordial)/],
  ["Household & galley", /\b(paper|towel|toilet|tissue|soap|detergent|wash|sponge|bin bag|rubbish|foil|cling|gas\b|lighter|match|batter(y|ies)|sunscreen|sun cream|insect)/],
];
export const OTHER_AISLE = "Other";
// Shop-walk order for the list headings.
export const AISLE_NAMES = ["Fresh produce", "Bakery", "Meat & fish", "Dairy & eggs", "Pantry & dry goods", "Tins & jars", "Herbs, spices & sauces", "Frozen", "Drinks", "Household & galley", OTHER_AISLE];

export const builtInAisle = (name) => {
  const s = ` ${String(name).toLowerCase()} `;
  return MATCH.find(([, re]) => re.test(s))?.[0] || null;
};
