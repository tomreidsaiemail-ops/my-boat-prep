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

// Iteration 60: production noise list including '(.*)', '.*', '[a-z]+' (compileNoise hardening).
console.log("\n--- production lists ---");
const L = (s, indent = false) => ({ label: s, ...(indent ? { indent: true } : {}) });
const PSYN = [L("1. Salt"), ...["Salt", "Table Salt", "Sea Salt", "Rock Salt", "Garlic Salt"].map((s) => L(s, true)),
  L("2. Tomatoes"), ...["Tinned Plum Tomatoes", "Fresh Cherry Tomatoes", "Tomato"].map((s) => L(s, true)),
  L("4. Pepper"), ...["Black Peppercorns", "Ground Black Pepper", "White Pepper"].map((s) => L(s, true))];
const PNOISE = ["[0-9]+", "[0-9]/[0-9]", "(.*)", "[0-9]g", "[0-9]grams", "[0-9]grammes", "tbsp", "tsp", "fresh", "frozen", "tinned", "canned", "finely", "sliced", "diced", "dried", "of", "or", "pinch", "salted", "unsalted", "large", "small", ".*", "[a-z]+", "(oops"].map((s) => L(s));
const P = m.matchRules({ synonyms: PSYN, noise: PNOISE });
console.log("noise:", JSON.stringify({ words: P.noise.words.length, patterns: P.noise.patterns.map(String), spans: P.noise.spans.map(String) }));
console.log("synonym keys:", [...P.synonyms.keys()].join(" | "));
const t = (ok, name) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${name}`); };
t(P.synonyms.size >= 12, "synonym map built (not wiped by '(.*)')");
t(P.noise.spans.some((r) => r.source === "\\(.*?\\)"), "'(.*)' compiled to literal-bracket lazy span");
t(!P.noise.patterns.concat(P.noise.spans).some((r) => r.test("salt") || r.test("")), "no pattern matches '' or 'salt' ('.*','[a-z]+' skipped)");
check("P Salt 1 tsp vs Sea Salt", ["Salt 1 tsp"], ["Sea Salt"], "Sea Salt", P);
check("P Sea salt 1 tsp vs Salt", ["Sea salt 1 tsp"], ["Salt"], "Salt", P);
check("P Tomatoes (finely chopped) 200g vs Tinned plum tomatoes 400g", ["Tomatoes (finely chopped) 200g"], ["Tinned plum tomatoes 400g"], "Tinned plum tomatoes 400g", P);
check("P Ground black pepper vs White Pepper", ["Ground black pepper"], ["White Pepper"], "White Pepper", P);
check("P Fresh peas 200g vs Frozen peas", ["Fresh peas 200g"], ["Frozen peas"], "Frozen peas", P);
check("P Garlic salt vs Rock Salt", ["Garlic salt"], ["Rock Salt"], "Rock Salt", P);
check("P Salted butter 20g vs Sea Salt -> none", ["Salted butter 20g"], ["Sea Salt"], null, P);
check("P Tomatoes vs White Pepper -> none", ["Tomatoes 200g"], ["White Pepper"], null, P);
check("P 1/2 tsp salt vs Sea Salt", ["1/2 tsp salt"], ["Sea Salt"], "Sea Salt", P);
const exP = check("P exact Sea salt 2 vs Sea Salt -> no sub", ["Sea salt 2"], ["Sea Salt"], null, P);
t(exP?.mpa.areas?.length === 1, "P exact match keeps solid on-board areas");
check("P PROV Salt vs Sea Salt", ["Rice 200g"], ["Sea Salt"], "Sea Salt", P, ["Salt"]);
// non-food area never matches
const rowsNF = m.buildShopping({ lists: [{ tag: "A", name: "L", meals: [{ name: "Dinner", ingredients: ["Sea salt 1 tsp"] }] }], adults: 1, children: 0, days: 1,
  stock: m.foodStock([{ id: "b", name: "Bosun locker", food: false, items: [{ id: "x", name: "Salt", qty: 1 }] }]), rules: P });
const nf = rowsNF.find((x) => x.mpa && /Sea salt/.test(x.mpa.base));
t(!nf.mpa.subs && !nf.mpa.areas, "P non-food area Salt -> no badge");
// edge: comma inside brackets (splitParts runs before span stripping)
check("P EDGE Tomatoes (finely chopped, drained) vs Tinned plum tomatoes", ["Tomatoes (finely chopped, drained) 200g"], ["Tinned plum tomatoes"], "Tinned plum tomatoes", P);
console.log(`\nTOTAL ${pass} passed, ${fail} failed`);
