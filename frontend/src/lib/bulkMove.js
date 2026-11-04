// Bulk Move Items To Another List: ticked items (a heading brings its sub-items) leave the source and join the target.
import { BUDGET_KIND, newBudgetItem } from "@/lib/budget";
import { MAINT_KIND } from "@/lib/maint";
import { movedRow } from "@/lib/sheetImport";

// Ids of a heading's sub-items (a heading is a top-level item followed by indented ones).
export const childrenOf = (items, n) => {
  const out = [];
  for (let k = n + 1; k < items.length && items[k].indent; k += 1) out.push(items[k].id);
  return out;
};

// Lists that can take moved items: checklists, maintenance/custom/imported lists and the Boat Budget.
const NOT_TARGETS = ["shipsLog", "mealPlan"];
export const canTakeItems = (l) => (!l.kind || l.kind === MAINT_KIND || l.kind === BUDGET_KIND) && !NOT_TARGETS.includes(l.id);

const toRow = (item, src, target, id, defs, targetDefs, labelFor) => {
  const isMaint = src.kind === MAINT_KIND;
  if (isMaint && item.indent) return movedRow(item, defs, target, id, targetDefs);
  if (target.kind === MAINT_KIND) return { id, label: (isMaint ? item.label : labelFor(item)).slice(0, 1000), checked: false, maint: true, attrs: {} };
  if (target.kind === BUDGET_KIND) return item.budget ? { ...item, id } : newBudgetItem(id, (isMaint ? item.label : labelFor(item)).slice(0, 200));
  if (isMaint) return { id, label: item.label, checked: false };
  return item.budget ? { id, label: labelFor(item).slice(0, 1000), checked: false } : { ...item, id };
};

export const bulkMove = ({ source, sourceItems, target, targetItems, ids, defs = [], targetDefs = [], labelFor }) => {
  const picked = new Set(ids);
  const maint = target.kind === MAINT_KIND;
  const budget = target.kind === BUDGET_KIND;
  let next = Math.max(Date.now(), ...targetItems.map((i) => Number(i.id) || 0)) + 1;
  const rows = [];
  const loose = [];
  let headMoved = false;
  sourceItems.forEach((item, n) => {
    const heading = !item.indent && !!sourceItems[n + 1]?.indent;
    if (!item.indent) headMoved = heading && picked.has(item.id);
    if (!picked.has(item.id)) return;
    if (budget && heading) return;
    const row = toRow(item, source, target, next, defs, targetDefs, labelFor);
    next += 1;
    if (budget) { rows.push(row); return; }
    if (item.indent && headMoved) { rows.push({ ...row, indent: true }); return; }
    if (heading) { rows.push({ ...row, indent: false }); return; }
    // An item whose heading stays behind (or a plain item) goes under "Moved items" in a maintenance list, un-indented elsewhere.
    if (maint) loose.push({ ...row, indent: true });
    else rows.push({ ...row, indent: false });
  });
  const useLast = maint && !rows.length && targetItems.some((i) => !i.indent);
  const tail = loose.length ? [...(useLast ? [] : [{ id: next, label: "Moved items", checked: false, maint: true, attrs: {} }]), ...loose] : [];
  return { source: sourceItems.filter((i) => !picked.has(i.id)), target: [...targetItems, ...rows, ...tail] };
};
