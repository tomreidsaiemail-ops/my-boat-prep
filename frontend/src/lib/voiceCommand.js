// Spoken cupboard commands: "remove milk from fridge", "put 2 cheese into the fridge", "batch magic scan the galley".
import { applyQr, matchItem } from "@/lib/qrStock";

const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, dozen: 12 };
const clean = (s) => s.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
const strip = (s) => s.replace(/^(the|some|my|our)\s+/, "").replace(/\s+(please|thanks|thank you)$/, "").trim();
const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export const SPEAK_EXAMPLES = ["Remove milk from fridge", "Put 2 cheese into the fridge", "Batch magic scan the galley"];

const withQty = (s) => {
  const m = strip(s).match(/^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|dozen)\s+(.+)$/);
  return m ? { qty: Number(m[1]) || WORDS[m[1]] || 1, item: strip(m[2]) } : { qty: 1, item: strip(s) };
};

export const parseCommand = (heard) => {
  const t = clean(heard).replace(/^(please|can you|could you|i'd like to|i would like to|i want to)\s+/, "");
  let m = t.match(/batch\s*magic\s*scan\s+(?:of\s+)?(.+)$/);
  if (m) return { kind: "batch", zone: strip(m[1]) };
  m = t.match(/^(?:remove|take out|take|used|use)\s+(.+?)\s+(?:from|out of)\s+(.+)$/);
  if (m) return { kind: "remove", ...withQty(m[1]), cupboard: strip(m[2]) };
  m = t.match(/^(?:put|add|place|store)\s+(.+?)\s+(?:into|in|inside|to)\s+(.+)$/);
  if (m) return { kind: "put", ...withQty(m[1]), cupboard: strip(m[2]) };
  return null;
};

// Inside one known cupboard (the QR window) only the item is needed: "add cheese", "remove milk", or just "cheese".
export const parseItem = (heard, mode) => {
  const t = clean(heard);
  const m = t.match(/^(add|put|remove|take out|take|used)\s+(.+)$/);
  const kind = m ? (/^(add|put)$/.test(m[1]) ? "put" : "remove") : mode;
  return { kind, ...withQty(m ? m[2].replace(/\s+(in|into|from|out of)\s+.*$/, "") : t) };
};

const findCupboard = (areas, name) => {
  const n = name.toLowerCase();
  const tops = areas.filter((a) => !a.parent_id);
  return tops.find((a) => a.name.toLowerCase() === n) || tops.find((a) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase()));
};

// What a command would do, or an error to show; `run(areas)` applies it to the cupboards.
export const planCommand = (heard, areas, zones = []) => {
  const c = parseCommand(heard);
  if (!c) return { error: `Sorry, I couldn't make sense of "${heard}".` };
  if (c.kind === "batch") {
    const z = zones.find((x) => x.label.toLowerCase() === c.zone || c.zone.includes(x.label.toLowerCase()) || c.zone.includes(x.colour.toLowerCase()));
    if (!z) return { error: `"${c.zone}" isn't one of your zones${zones.length ? ` (${zones.map((x) => x.label).join(", ")})` : ""}.` };
    return { message: `Batch Magic Scan the ${z.label} – ${z.colour}?`, batch: z };
  }
  const box = findCupboard(areas, c.cupboard);
  if (!box) return { error: `"${c.cupboard}" heard is not a cupboard.` };
  const stock = (box.items || []).filter((i) => !i.removed && (i.qty === undefined || Number(i.qty) > 0));
  if (c.kind === "remove") {
    const hit = matchItem(stock, c.item);
    if (!hit) return { error: `There is no ${c.item} in ${box.name}.` };
    return { message: `Remove ${c.qty} ${hit.name} from ${box.name}?`, areaId: box.id, list: [{ itemId: hit.id, qty: c.qty }], mode: "out" };
  }
  return { message: `Put ${c.qty} ${title(c.item)} into ${box.name}?`, areaId: box.id, list: [{ name: title(c.item), qty: c.qty }], mode: "add" };
};

export const runPlan = (plan, areas) => areas.map((a) => (a.id === plan.areaId ? { ...a, items: applyQr(a.items || [], plan.list, plan.mode) } : a));
