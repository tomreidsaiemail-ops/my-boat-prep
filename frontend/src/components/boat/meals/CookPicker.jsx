// Who preps and cooks this meal; saved on the meal line as "(Cook: Name)".
export const CookPicker = ({ value, cooks, onChange }) => {
  const options = [...new Set([...cooks, value].filter(Boolean))];
  return (
    <label className="flex flex-col gap-1 text-sm font-bold">Cook
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field-input" data-testid="edit-item-cook-select">
        <option value="">Not assigned</option>
        {options.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="text-xs font-normal text-[var(--muted)]">Shows on the Cook's Rota for everyone on board.</span>
    </label>
  );
};
