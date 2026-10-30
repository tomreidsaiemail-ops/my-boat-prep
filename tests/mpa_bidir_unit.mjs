// Unit check of bidirectional synonym matching in mpa.js (iteration 59). Run: node /app/tests/mpa_bidir_unit.mjs
import fs from "fs";
const src = fs.readFileSync("/app/frontend/src/lib/mpa.js", "utf8");
fs.writeFileSync("/tmp/mpa_copy.mjs", src);
const m = await import("/tmp/mpa_copy.mjs");
const syn = [{ label: "1. Salt" }, { label: "Table Salt", indent: true }, { label: "Sea salt", indent: true }];
const noise = [{ label: "[0-9]g" }];
const rules = m.matchRules({ synonyms: syn, noise });
const area = (names) => [{ id: "a", name: "Galley", food: true, items: names.map((n, i) => ({ id: `i${i}`, name: n, qty: 1 })) }];
const run = (ingr, food, r = rules, provisions = []) => {
  const lists = [{ tag: "A", name: "L", meals: [{ name: "Dinner", ingredients: ingr }] }];
  return m.buildShopping({ lists, adults: 1, children: 0, days: 1, stock: m.foodStock(area(food)), provisions, rules: r }).filter((x) => x.mpa && !x.mpa.meals?.length || x.mpa?.prov || (x.mpa && x.mpa.meals?.length && !/^Dinner$/.test(x.mpa.base)));
};
let pass = 0, fail = 0;
const check = (name, ingr, food, expectSub, r, prov) => {
  const rows = run(ingr, food, r, prov);
  const row = rows.find((x) => (prov ? x.mpa.prov : x.mpa.base !== "Dinner"));
  const subs = (row?.mpa.subs || []).map((s) => s.name);
  const ok = expectSub === null ? subs.length === 0 : subs.includes(expectSub);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: row='${row?.mpa.base}' areas=${JSON.stringify(row?.mpa.areas || [])} subs=${JSON.stringify(subs)}`);
  return row;
};
check("Salt 1 tsp vs Sea salt", ["Salt 1 tsp"], ["Sea salt"], "Sea salt");
check("Sea salt 1 tsp vs Salt", ["Sea salt 1 tsp"], ["Salt"], "Salt");
check("Table salt vs Sea Salt 500g", ["Table salt"], ["Sea Salt 500g"], "Sea Salt 500g");
check("Salt and pepper to taste vs Sea salt", ["Salt and pepper to taste"], ["Sea salt"], "Sea salt");
check("Pinch of salt vs Table Salt", ["Pinch of salt"], ["Table Salt"], "Table Salt");
check("Salted butter 20g vs Sea salt -> none", ["Salted butter 20g"], ["Sea salt"], null);
const ex = check("Exact Table salt 2 vs Table Salt -> no sub", ["Table salt 2"], ["Table Salt"], null);
console.log("  exact areas:", ex?.mpa.areas, "base:", ex?.mpa.base);
check("No rules: Salt vs Sea salt -> none", ["Salt 1 tsp"], ["Sea salt"], null, null);
check("No rules split: Olive oil and mustard vs Olive oil", ["Olive oil and mustard"], ["Olive oil"], "Olive oil", null);
check("PROV Salt vs Sea salt", ["Rice 200g"], ["Sea salt"], "Sea salt", rules, ["Salt"]);
check("PROV Sea salt vs Salt", ["Rice 200g"], ["Salt"], "Salt", rules, ["Sea salt"]);
console.log(`\n${pass} passed, ${fail} failed`);
