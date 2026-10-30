// Iteration 61: does a YouTube URL inside an ingredient break MPA on-board matching / merging? Run: node /app/tests/yt_mpa_unit.mjs
import fs from "fs";
fs.copyFileSync("/app/frontend/src/lib/youtube.js", "/tmp/youtube_copy.mjs");
fs.writeFileSync("/tmp/mpa_copy61.mjs", fs.readFileSync("/app/frontend/src/lib/mpa.js", "utf8").replace("@/lib/youtube", "/tmp/youtube_copy.mjs"));
const m = await import("/tmp/mpa_copy61.mjs");
const area = (names) => [{ id: "a", name: "Galley", food: true, items: names.map((n, i) => ({ id: `i${i}`, name: n, qty: 1 })) }];
const run = (meals, food) => m.buildShopping({ lists: [{ tag: "A", name: "L", meals }], adults: 1, children: 0, days: 1, stock: m.foodStock(area(food)), provisions: [], rules: null })
  .map((x) => ({ label: x.label, base: x.mpa?.base, areas: x.mpa?.areas }));
console.log("plain:", JSON.stringify(run([{ name: "D", ingredients: ["Basil"] }], ["Basil"])));
console.log("with url:", JSON.stringify(run([{ name: "D", ingredients: ["Basil https://youtu.be/basil99"] }], ["Basil"])));
console.log("merge:", JSON.stringify(run([{ name: "D", ingredients: ["Basil 10g https://youtu.be/x"] }, { name: "E", ingredients: ["Basil 10g"] }], [])));
