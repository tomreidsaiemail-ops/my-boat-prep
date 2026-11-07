import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Fish, Loader2, MapPin, Ruler, UtensilsCrossed } from "lucide-react";
import { api, API, apiError } from "@/lib/api";
import { localWhen } from "@/lib/timeAgo";

const Section = ({ title, tone = "bg-white", testId, children }) => (
  <section className={`rounded-lg border-[1.5px] border-[var(--line)] p-3 ${tone}`} data-testid={testId}>
    <h3 className="mb-1.5 font-display text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">{title}</h3>
    <div className="space-y-1.5 text-sm leading-relaxed">{children}</div>
  </section>
);

const Bullets = ({ items, testId }) => (items?.length ? (
  <ul className="list-disc space-y-1 pl-5" data-testid={testId}>{items.map((t, k) => <li key={k}>{t}</li>)}</ul>
) : null);

const Steps = ({ items, testId }) => (items?.length ? (
  <ol className="list-decimal space-y-1 pl-5" data-testid={testId}>{items.map((t, k) => <li key={k}>{t}</li>)}</ol>
) : null);

const sizeText = (size, imperial) => {
  const out = [];
  if (size.count > 1) out.push(`${size.count} of them`);
  if (size.length_cm) out.push(imperial ? `${(size.length_cm / 2.54).toFixed(1)} in (${size.length_cm} cm)` : `${size.length_cm} cm (${(size.length_cm / 2.54).toFixed(1)} in)`);
  if (size.weight_kg) out.push(imperial ? `about ${(size.weight_kg * 2.20462).toFixed(1)} lb (${size.weight_kg} kg)` : `about ${size.weight_kg} kg (${(size.weight_kg * 2.20462).toFixed(1)} lb)`);
  return out.join(" · ");
};

const AddToMeals = ({ meal, fish }) => {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!meal?.name) return null;
  const add = async () => {
    setBusy(true);
    try {
      await api.post("/me/meals", { name: meal.name, recipe: meal.recipe, ingredients: meal.ingredients, meal_type: meal.meal_type });
      setDone(true);
      toast.success(`${meal.name} has been added to your Common Meals, ready for your next meal plan`);
    } catch (e) { toast.error(apiError(e, "Couldn't add it to your Common Meals")); }
    finally { setBusy(false); }
  };
  return (
    <Section title={`Make a meal of your ${fish}`} testId="fish-meal">
      <p className="font-bold" data-testid="fish-meal-name">{meal.name}</p>
      {meal.recipe && <p>{meal.recipe}</p>}
      <button type="button" className="btn-solid h-11 w-full justify-center gap-2" onClick={add} disabled={busy || done} data-testid="fish-add-meal-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UtensilsCrossed className="h-4 w-4" />} {done ? "Added to Common Meals" : "Add to my Common Meals"}
      </button>
    </Section>
  );
};

// The Magic Fish Whisperer's report for one catch.
export const FishReport = ({ c, imperial, preview }) => {
  const r = c.report;
  const sp = r.species;
  const shell = r.kind === "shellfish";
  return (
    <div className="flex flex-col gap-2.5" data-testid="fish-report">
      <div className="flex items-start gap-3">
        {(preview || c.has_photo) && <img src={preview || `${API}/me/catches/${c.catch_id}/photo`} alt={sp.common_name} className="h-24 w-24 shrink-0 rounded-md border-[1.5px] border-[var(--line)] object-cover" data-testid="fish-report-photo" />}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-xl font-extrabold leading-tight" data-testid="fish-species"><Fish className="h-5 w-5 shrink-0" /> {sp.common_name}</p>
          {sp.scientific_name && <p className="text-sm italic text-[var(--muted)]" data-testid="fish-scientific">{sp.scientific_name}</p>}
          {sp.other_names?.length > 0 && <p className="text-xs text-[var(--muted)]">Also called {sp.other_names.join(", ")}</p>}
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${sp.confidence === "high" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`} data-testid="fish-confidence">{sp.confidence} confidence</span>
          {sizeText(r.size, imperial) && <p className="mt-1 flex items-center gap-1 text-sm font-bold" data-testid="fish-size"><Ruler className="h-4 w-4" /> {sizeText(r.size, imperial)}</p>}
          <p className="text-xs text-[var(--muted)]">{localWhen(c.created_at)}</p>
        </div>
      </div>
      {r.size.how && <p className="text-xs text-[var(--muted)]" data-testid="fish-size-how">Size estimate: {r.size.how}</p>}
      {r.toxins?.length > 0 && <Section title="Watch out" tone="bg-red-50" testId="fish-toxins"><p className="flex items-center gap-1 font-bold text-[var(--red)]"><AlertTriangle className="h-4 w-4" /> Never eat {shell ? "seafood" : "a fish"} you're unsure is safe.</p><Bullets items={r.toxins} /></Section>}
      {shell && (r.safety?.biotoxins?.length > 0 || r.safety?.gathering?.length > 0) && <Section title="Biotoxins and safe gathering" tone="bg-red-50" testId="fish-shell-safety">
        <p className="flex items-center gap-1 font-bold text-[var(--red)]"><AlertTriangle className="h-4 w-4" /> Check current shellfish biotoxin and red tide warnings before gathering or eating.</p>
        <Bullets items={r.safety.biotoxins} testId="fish-biotoxins" />
        {r.safety.gathering.length > 0 && <><p className="font-bold">Safe gathering</p><Bullets items={r.safety.gathering} testId="fish-gathering" /></>}
      </Section>}
      <Section title={`Why it's a ${sp.common_name}`} testId="fish-reasons"><Bullets items={sp.reasons} /></Section>
      {r.similar?.length > 0 && <Section title="Close and similar species" testId="fish-similar">
        <ul className="space-y-1">{r.similar.map((s, k) => <li key={k}><b>{s.name}</b>{s.difference ? `: ${s.difference}` : ""}</li>)}</ul>
      </Section>}
      <Section title="Where it was caught" testId="fish-place">
        <p className="flex items-center gap-1 font-bold"><MapPin className="h-4 w-4 shrink-0" /> {r.place.name || "Unknown area"}{c.position ? ` · ${c.position}` : ""}</p>
        <Bullets items={[...r.place.notes, ...r.local_knowledge]} testId="fish-local" />
      </Section>
      <Section title={shell ? "Bag limits, sizes and closures" : "Fishing rules"} testId="fish-rules">
        {r.regulations.local.length > 0 && <><p className="font-bold">Local</p><Bullets items={r.regulations.local} /></>}
        {r.regulations.national.length > 0 && <><p className="font-bold">National</p><Bullets items={r.regulations.national} /></>}
        <p className="text-xs font-bold text-amber-800">Always double check with your local authorities: rules change.</p>
      </Section>
      {r.sources?.length > 0 && <Section title="Stay informed" testId="fish-sources">
        <ul className="space-y-1">{r.sources.map((s, k) => <li key={k}><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[var(--blue)] underline" data-testid={`fish-source-${k}`}>{s.name} <ExternalLink className="h-3.5 w-3.5" /></a></li>)}</ul>
      </Section>}
      {r.questions?.length > 0 && <Section title="Questions to ask your local authority" testId="fish-questions"><Bullets items={r.questions} /></Section>}
      <Section title={shell ? "Cleaning and preparing" : "Filleting"} testId="fish-filleting">
        <Steps items={r.filleting.steps} />
        {r.filleting.careful.length > 0 && <><p className="font-bold">Be careful of</p><Bullets items={r.filleting.careful} /></>}
        {r.filleting.protection.length > 0 && <><p className="font-bold">Protection</p><Bullets items={r.filleting.protection} /></>}
      </Section>
      {shell && r.cooking?.map((m, k) => (
        <Section key={k} title={`Cook it: ${m.name}`} testId={`fish-cooking-${k}`}>
          {m.ingredients.length > 0 && <><p className="font-bold">Ingredients</p><Bullets items={m.ingredients} /></>}
          <Steps items={m.steps} />
        </Section>
      ))}
      {!shell && r.batter.ingredients.length > 0 && <Section title={r.batter.name || "A good batter"} testId="fish-batter">
        <p className="font-bold">Ingredients</p><Bullets items={r.batter.ingredients} />
        <p className="font-bold">Method</p><Steps items={r.batter.steps} />
      </Section>}
      <Section title={shell ? "Eating it raw?" : "Sushi or sashimi?"} tone={r.sushi.suitable ? "bg-emerald-50" : "bg-amber-50"} testId="fish-sushi">
        <p className="font-bold" data-testid="fish-sushi-verdict">{shell ? (r.sushi.suitable ? "Can be eaten raw when gathered safely" : "Cook it, don't eat it raw") : r.sushi.suitable ? "Suitable for sushi" : "Not recommended for sushi"}</p>
        {r.sushi.why && <p>{r.sushi.why}</p>}
      </Section>
      <AddToMeals meal={r.meal} fish={sp.common_name} />
    </div>
  );
};
