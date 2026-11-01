import { useState } from "react";
import { Check, Martini, ShoppingBasket, X, Youtube } from "lucide-react";
import { missingIngredients } from "@/lib/bartender";
import { MissingToProvisionsDialog } from "@/components/boat/bartender/MissingToProvisionsDialog";

const Photo = ({ src, name }) => {
  const [bad, setBad] = useState(false);
  return src && !bad
    ? <img src={src} alt={name} loading="lazy" onError={() => setBad(true)} className="h-16 w-16 shrink-0 rounded-md object-cover" data-testid="cocktail-photo" />
    : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700" data-testid="cocktail-photo-fallback"><Martini className="h-7 w-7" /></span>;
};

const CocktailRow = ({ item, readOnly, onToggle, onDelete }) => (
  <li className="flex items-start gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-2.5" data-testid={`cocktail-${item.id}`}>
    <button type="button" onClick={() => onToggle(item.id)} aria-pressed={!!item.checked} aria-label={`Mark ${item.label} as made`} data-testid={`cocktail-tick-${item.id}`}
      className={`mt-5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${item.checked ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)]"}`}>
      {item.checked && <Check className="h-4 w-4" />}
    </button>
    <Photo src={item.photo} name={item.label} />
    <div className="min-w-0 flex-1">
      <p className={`font-bold ${item.checked ? "text-[var(--muted)] line-through" : ""}`} data-testid={`cocktail-name-${item.id}`}>
        {item.label}
        {item.mocktail && <span className="ml-1.5 inline-block rounded-full bg-sky-100 px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase text-sky-800 no-underline" data-testid={`cocktail-mocktail-${item.id}`}>Alcohol-free</span>}
      </p>
      {item.uses?.length > 0 && <p className="text-xs text-[var(--muted)]">With: {item.uses.join(", ")}</p>}
      {item.missing?.length ? <p className="text-xs font-bold text-[var(--amber)]" data-testid={`cocktail-missing-${item.id}`}>Buy: {item.missing.join(", ")}</p>
        : <p className="text-xs font-bold text-emerald-700" data-testid={`cocktail-ready-${item.id}`}>You have everything on board</p>}
      <a href={item.youtube} target="_blank" rel="noopener noreferrer" data-testid={`cocktail-youtube-${item.id}`}
        className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white [transition:background-color_.15s] hover:bg-red-700">
        <Youtube className="h-3.5 w-3.5" /> How to make it
      </a>
    </div>
    {!readOnly && (
      <button type="button" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.label}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted)] hover:text-[var(--red)]" data-testid={`cocktail-delete-${item.id}`}>
        <X className="h-4 w-4" />
      </button>
    )}
  </li>
);

export const CocktailList = ({ items, readOnly, onToggle, onDelete, onRemix, provisions = [], onAddProvisions }) => {
  const [shopping, setShopping] = useState(false);
  const missing = missingIngredients(items);
  return (
    <div className="flex flex-col gap-3" data-testid="cocktail-list">
      {!readOnly && missing.length > 0 && (
        <button type="button" className="btn-ghost h-11 justify-center gap-2" onClick={() => setShopping(true)} data-testid="cocktail-shopping-btn">
          <ShoppingBasket className="h-4 w-4" /> Add missing ingredients to Provisions ({missing.length})
        </button>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((i) => <CocktailRow key={i.id} item={i} readOnly={readOnly} onToggle={onToggle} onDelete={onDelete} />)}
        {!items.length && <li className="rounded-lg border-[1.5px] border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]" data-testid="cocktail-empty">No cocktails yet.</li>}
      </ul>
      {!readOnly && (
        <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={onRemix} data-testid="cocktail-remix-btn"><Martini className="h-4 w-4" /> Ask the Magic Bartender again</button>
      )}
      <MissingToProvisionsDialog open={shopping} missing={missing} provisions={provisions} onClose={() => setShopping(false)}
        onConfirm={(names) => { if (onAddProvisions(names)) setShopping(false); }} />
    </div>
  );
};
