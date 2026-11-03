import { mergePlan, applyMerge, changeKey } from "../frontend/src/lib/merge.js";
const L = (...a) => a.map((label, i) => ({ id: i + 1, label, checked: false }));
const base = L("Fuel", "Water", "Charts", "Flares");
const master = L("Fuel", "Water", "Lifejackets", "Charts", "VHF check");   // added Lifejackets, VHF; removed Flares
const local = [...L("Fuel", "Charts", "Flares", "My snacks")]; local[0].checked = true;   // user removed Water, added My snacks
const p = mergePlan(base, master, local);
console.log("add", p.add.map(i=>i.label), "remove", p.remove.map(i=>i.label), "mineAdded", p.mineAdded.map(i=>i.label), "mineRemoved", p.mineRemoved.map(i=>i.label));
const none = applyMerge(local, master, p, new Set());
console.log("none", none.map(i=>i.label).join(","), none[0].checked);
const all = applyMerge(local, master, p, new Set([...p.add.map(i=>changeKey("add",i)), ...p.remove.map(i=>changeKey("remove",i))]));
console.log("all", all.map(i=>i.label).join(","), new Set(all.map(i=>i.id)).size === all.length);
const p2 = mergePlan(null, master, local);
console.log("2way add", p2.add.map(i=>i.label), "remove", p2.remove.map(i=>i.label));
