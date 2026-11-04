import { useState } from "react";
import { ChevronDown } from "lucide-react";

const Flag = ({ on, letter, label, onClick, testId }) => (
  <button type="button" onClick={onClick} aria-pressed={on} aria-label={`${label} area`} title={`${label} area`} data-testid={testId}
    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[12px] font-extrabold [transition:background-color_.15s,color_.15s] ${on
      ? letter === "F" ? "border-emerald-700 bg-emerald-700 text-white" : "border-purple-700 bg-purple-700 text-white" : "border-slate-400 text-slate-400"}`}>{letter}</button>
);

const Row = ({ t, onChange, other }) => (
  <li className="flex items-center gap-2" data-testid={`shop-area-${t.id}`}>
    {!other && <input type="checkbox" checked={t.use} onChange={(e) => onChange({ use: e.target.checked })} className="h-5 w-5 shrink-0 accent-[var(--navy)]"
      aria-label={`Use ${t.name}`} data-testid={`shop-area-use-${t.id}`} />}
    <span className={`min-w-0 flex-1 truncate text-sm font-bold ${t.use || other ? "" : "text-slate-400 line-through"}`}>{t.name}
      {t.isNew && <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-sky-800">new</span>}</span>
    <Flag on={t.food} letter="F" label="Food" onClick={() => onChange({ food: !t.food, use: true })} testId={`shop-area-food-${t.id}`} />
    <Flag on={t.drinks} letter="D" label="Drinks" onClick={() => onChange({ drinks: !t.drinks, use: true })} testId={`shop-area-drinks-${t.id}`} />
  </li>
);

// Pick the Food (F) and Drink (D) areas the shopping goes into; other boat areas can be tagged F/D too.
export const ShopAreasStep = ({ targets, setTargets, others, onTagOther }) => {
  const [showOthers, setShowOthers] = useState(false);
  const set = (id, p) => setTargets((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  return (
    <div className="flex flex-col gap-3" data-testid="shop-areas-step">
      <p className="text-sm">The MPA puts your shopping into these Food <b>(F)</b> and Drink <b>(D)</b> boat areas, one Shopping Set each. Untick any you don&apos;t need today. Areas marked <b>new</b> are added to your Boat Inventory.</p>
      <ul className="flex flex-col gap-2">{targets.map((t) => <Row key={t.id} t={t} onChange={(p) => set(t.id, p)} />)}</ul>
      {others.length > 0 && (
        <button type="button" onClick={() => setShowOthers((v) => !v)} className="flex items-center gap-1 self-start text-sm font-bold text-[var(--navy)] underline underline-offset-2" data-testid="shop-areas-show-others-btn">
          <ChevronDown className={`h-4 w-4 [transition:transform_.15s] ${showOthers ? "rotate-180" : ""}`} /> {showOthers ? "Hide other boat areas" : "Click here to show other boat areas"}
        </button>
      )}
      {showOthers && others.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-2" data-testid="shop-areas-others">
          <li className="text-xs text-[var(--muted)]">Tap F or D to use one of these for your shopping too.</li>
          {others.map((a) => <Row key={a.id} other t={{ ...a, food: false, drinks: false, use: true }} onChange={(p) => onTagOther(a, p)} />)}
        </ul>
      )}
    </div>
  );
};
