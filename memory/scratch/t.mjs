import { parseMeals, parseQty, buildShopping, initialsFor, keyOf, foodStock } from "/app/memory/scratch/mpa.mjs";
for (const s of ["500g pasta","2 onions","1 tsp salt","Salt","Pasta 100g","Eggs x2","Milk 200 ml","1/2 cup rice","2 cloves garlic","Tinned tomatoes 1 can","3 Carrots"]) console.log(s, JSON.stringify(parseQty(s)));
const tm = [{label:"1. Spaghetti Bolognese"},{label:"(Brown mince, add sauce)",indent:true},{label:"100g pasta",indent:true},{label:"1 onion",indent:true},{label:"Salt",indent:true},{label:"Curry"},{label:"(Fry spices)",indent:true},{label:"2 onions",indent:true},{label:"80 g rice",indent:true},{label:"Salt",indent:true},{label:"Not a meal"},{label:"thing",indent:true}];
const hm = [{label:"Fish tacos"},{label:"(Grill fish)",indent:true},{label:"150g fish",indent:true},{label:"1 tsp salt",indent:true}];
const tags = initialsFor(["Tom's Meals","Harry's Meals","Meal Plan"]); console.log(tags, keyOf("Tomatoes"), keyOf("Onions"), keyOf("Glass"));
const stock = foodStock([{food:true, items:[{name:"Onions", qty:3}, {name:"Rice", qty:1}]}, {food:false, items:[{name:"Salt",qty:1}]}]);
const out = buildShopping({ lists:[{tag:tags[0], meals: parseMeals(tm)}, {tag:tags[1], meals: parseMeals(hm)}], adults:2, children:2, days:5, stock, provisions:["Water","Pasta","Beer"], amounts:{Water:"40 L"} });
out.forEach(i => console.log(i.indent?"   ":"", i.checked?"[x]":"[ ]", i.label));
