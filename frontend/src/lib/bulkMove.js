// Bulk Move Items To Another List: ticked items (a heading brings its sub-items) leave the source and join the target.
import { BUDGET_KIND, newBudgetItem } from "@/lib/budget";
import { MAINT_KIND } from "@/lib/maint";
import { movedRow } from "@/lib/sheetImport";

// Indices of each heading's sub-items (a heading is a top-level item followed by indented ones).
export const childrenOf = (items, n) => {
  const out = [];
  for (let k = n + 1; k < items.length && items[k].indent; k += 1) out.push(items[k].id);
  return out;
};

const toRow = (item, src, target, id, defs, targetDefs, labelFor) => {
  const isMaint = src.kind === MAINT_KIND;
  if (isMaint && item.indent) return movedRow(item, defs, target, id, targetDefs);
  if (target.kind === MAINT_KIND) return { id, label: (isMaint ? item.label : labelFor(item)).slice(0, 1000), checked: false, maint: true, indent: !!item.indent, attrs: {} };
  if (target.kind === BUDGET_KIND) return item.budget ? { ...item, id } : newBudgetItem(id, (isMaint ? item.label : labelFor(item)).slice(0, 200));
  if (isMaint) return { id, label: item.label, checked: false };
  return item.budget ? { id, label: labelFor(item).slice(0, 1000), checked: false } : { ...item, id };
};

export const bulkMove = ({ source, sourceItems, target, targetItems, ids, defs = [], targetDefs = [], labelFor }) => {
  const picked = new Set(ids);
  let next = Math.max(Date.now(), ...targetItems.map((i) => Number(i.id) || 0)) + 1;
  const rows = [];
  let headMoved = false;
  sourceItems.forEach((item) => {
    if (!item.indent) headMoved = picked.has(item.id);
    if (!picked.has(item.id)) return;
    const row = toRow(item, source, target, next, defs, targetDefs, labelFor);
    next += 1;
    // A sub-item whose heading stays behind arrives as a plain item (or under "Moved items" in a maintenance list).
    const indent = item.indent ? headMoved || target.kind === MAINT_KIND : false;
    rows.push(target.kind === BUDGET_KIND ? row : { ...row, indent });
  });
  const needsHead = target.kind === MAINT_KIND && rows[0]?.indent && !targetItems.some((i) => !i.indent);
  const head = needsHead ? [{ id: next, label: "Moved items", checked: false, maint: true, attrs: {} }] : [];
  return { source: sourceItems.filter((i) => !picked.has(i.id)), target: [...targetItems, ...head, ...rows] };
};
