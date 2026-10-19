import { MapPin } from "lucide-react";

export const NO_AREA = "__none";

export const AreaFilter = ({ areas, value, onChange }) => (
  <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white px-3 py-2" data-testid="area-filter">
    <MapPin className="h-4 w-4 shrink-0 text-[var(--navy)]" />
    <span className="field-label shrink-0">Area</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-0 flex-1 rounded-md border-[1.5px] border-[var(--line)] bg-white px-2 text-base font-semibold"
      aria-label="Filter by area" data-testid="area-filter-select">
      <option value="">All areas</option>
      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      <option value={NO_AREA}>No area</option>
    </select>
  </label>
);

export const AreaPicker = ({ areas, value, onChange }) => (
  <label className="flex flex-col gap-1" data-testid="area-picker">
    <span className="field-label">Boat area</span>
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="field-input" data-testid="area-picker-select">
      <option value="">No area</option>
      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  </label>
);
