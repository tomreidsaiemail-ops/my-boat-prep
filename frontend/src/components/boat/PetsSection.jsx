import { useEffect, useState } from "react";
import { PawPrint, Plus, Trash2 } from "lucide-react";

const PET_TYPES = ["Dog", "Cat", "Bird", "Rabbit", "Fish"];
const OTHER = "__other";
const WEIGHT_RE = /^\d{0,3}([.,]\d{0,1})?$/;
const newPet = () => ({ id: `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type: "", name: "", breed: "", weight: "" });

const PetTypeField = ({ value, onChange, testId }) => {
  const [other, setOther] = useState(!!value && !PET_TYPES.includes(value));
  useEffect(() => { if (value) setOther(!PET_TYPES.includes(value)); }, [value]);
  const pick = (v) => { setOther(v === OTHER); onChange(v === OTHER ? "" : v); };
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="field-label">Pet type</span>
      <select value={other ? OTHER : value || ""} onChange={(e) => pick(e.target.value)} className="field-input" data-testid={`${testId}-type-select`}>
        <option value="">Choose...</option>
        {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        <option value={OTHER}>Other...</option>
      </select>
      {other && <input value={value} maxLength={40} placeholder="e.g. Ferret" onChange={(e) => onChange(e.target.value)} className="field-input" aria-label="Your pet type" data-testid={`${testId}-type-other-input`} />}
    </label>
  );
};

const PetCard = ({ pet, n, unit, onChange, onRemove }) => {
  const testId = `pet-${n}`;
  const set = (k) => (v) => onChange({ ...pet, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-2.5 rounded-lg border-[1.5px] border-[var(--line)] bg-[var(--panel)] p-3" data-testid={testId}>
      <div className="col-span-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-extrabold"><PawPrint className="h-4 w-4" /> Pet {n + 1}</span>
        <button type="button" onClick={onRemove} className="flex h-9 items-center gap-1 rounded-md px-2 text-sm font-bold text-[var(--red)] hover:bg-red-50" aria-label={`Remove pet ${n + 1}`} data-testid={`${testId}-remove-btn`}>
          <Trash2 className="h-4 w-4" /> Remove
        </button>
      </div>
      <PetTypeField value={pet.type} onChange={set("type")} testId={testId} />
      <label className="flex min-w-0 flex-col gap-1">
        <span className="field-label">Pet name</span>
        <input value={pet.name} maxLength={60} placeholder="e.g. Biscuit" onChange={(e) => set("name")(e.target.value)} className="field-input" data-testid={`${testId}-name-input`} />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="field-label">Breed</span>
        <input value={pet.breed} maxLength={60} placeholder="e.g. Labrador" onChange={(e) => set("breed")(e.target.value)} className="field-input" data-testid={`${testId}-breed-input`} />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="field-label">Weight</span>
        <span className="relative">
          <input type="text" inputMode="decimal" value={pet.weight} placeholder="Optional" className="field-input w-full pr-9" data-testid={`${testId}-weight-input`}
            onChange={(e) => WEIGHT_RE.test(e.target.value) && set("weight")(e.target.value.replace(",", "."))} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]" data-testid={`${testId}-weight-unit`}>{unit}</span>
        </span>
      </label>
    </div>
  );
};

// Pets on board, as many as needed; weight follows the boat's units (metres -> kg, feet -> lb).
export const PetsSection = ({ pets = [], units, onChange }) => {
  const unit = units === "ft" ? "lb" : "kg";
  const update = (i, pet) => onChange(pets.map((p, k) => (k === i ? pet : p)));
  return (
    <section className="col-span-2 flex flex-col gap-2" data-testid="pets-section">
      <span className="field-label">Pets on board</span>
      {pets.map((p, i) => <PetCard key={p.id || i} pet={p} n={i} unit={unit} onChange={(pet) => update(i, pet)} onRemove={() => onChange(pets.filter((_, k) => k !== i))} />)}
      {pets.length < 20 && (
        <button type="button" onClick={() => onChange([...pets, newPet()])} className="btn-ghost h-11 justify-center gap-2" data-testid="add-pet-btn">
          <Plus className="h-4 w-4" /> {pets.length ? "Add another pet" : "Add a pet"}
        </button>
      )}
    </section>
  );
};
