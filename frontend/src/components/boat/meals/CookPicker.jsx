// A name picker for meal cooks and Provisions shoppers.
export const CookPicker = ({ value, cooks, onChange, label = "Cook", help = "Shows on the Cook's Rota for everyone on board.", testId = "edit-item-cook-select" }) => {
  const options = [...new Set([...cooks, value].filter(Boolean))];
  return (
    <label className="flex flex-col gap-1 text-sm font-bold">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field-input" data-testid={testId}>
        <option value="">Not assigned</option>
        {options.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="text-xs font-normal text-[var(--muted)]">{help}</span>
    </label>
  );
};
