// Node check of multi-level outline helpers (Departure ticking, removeOutline promotion, stale level after partial delete)
import { tickDeparture, departureTicked, removeOutline, outlineInfo, setIndent } from "/tmp/outline.mjs";
const L = [
  { id: 1, label: "Tidy" }, { id: 2, label: "Departure", checked: false },
  { id: 3, label: "A", indent: true }, { id: 4, label: "B", indent: true, level: 2 }, { id: 5, label: "C", indent: true },
  { id: 6, label: "Next" },
];
let t = tickDeparture(L, 2);
console.log("tick head ->", t.map((i) => `${i.id}:${!!i.checked}`).join(" "), "departureTicked", departureTicked(t));
t = tickDeparture(t, 4);
console.log("untick level2 B ->", t.map((i) => `${i.id}:${!!i.checked}`).join(" "));
t = tickDeparture(t, 4);
console.log("retick B ->", t.map((i) => `${i.id}:${!!i.checked}`).join(" "));
const num = (xs) => { const o = outlineInfo(xs); return xs.map((i) => `${i.label}=${o[i.id].num}`).join(" "); };
const T = [{ id: 1, label: "W" }, { id: 2, label: "P", indent: true }, { id: 3, label: "M", indent: true, level: 2 }, { id: 4, label: "S", indent: true, level: 3 }, { id: 5, label: "M2", indent: true, level: 2 }, { id: 6, label: "H", indent: true }];
console.log("before", num(T));
const r = removeOutline(T, 2);
console.log("removeOutline(P)", num(r), JSON.stringify(r.map((i) => [i.label, i.indent, i.level])));
// stale level: delete M only via filter (what removeMany does)
const f = T.filter((i) => i.id !== 3);
console.log("filter M", num(f), "S stored level", f.find((i) => i.id === 4).level, "S depth", outlineInfo(f)[4].depth);
