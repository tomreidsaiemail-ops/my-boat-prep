import { ChefHat } from "lucide-react";
import { cooksRota } from "@/lib/mealPlans";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Who cooks what, by day, across every meal plan on the boat. Everyone on board sees the whole rota.
export const CooksRota = ({ lists, data, me = "" }) => {
  const rota = cooksRota(lists, data);
  if (!rota.length) return null;
  const mine = (cook) => !!me && cook.toLowerCase().split(/[\s(]/)[0] === me.toLowerCase().split(/\s/)[0];
  return (
    <section className="flex flex-col gap-2 rounded-lg border-2 border-[var(--navy)] bg-white p-3" data-testid="cooks-rota">
      <h3 className="flex items-center gap-2 font-display text-base font-extrabold uppercase tracking-tight"><ChefHat className="h-5 w-5" /> Cook's Rota</h3>
      {rota.map((c) => (
        <div key={c.cook} className={`rounded-md p-2 ${mine(c.cook) ? "bg-amber-50 ring-2 ring-amber-400" : "bg-[var(--bg,#f6f7f9)]"}`} data-testid={`cooks-rota-${slug(c.cook)}`}>
          <p className="text-sm font-extrabold">{c.cook}{mine(c.cook) && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] text-[var(--navy)]" data-testid="cooks-rota-you">Your turns</span>}</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm">
            {c.meals.map((m) => (
              <li key={m.id} className={m.done ? "text-[var(--muted)] line-through" : ""} data-testid={`cooks-rota-meal-${m.id}`}>
                {m.meal}<span className="ml-1 text-xs text-[var(--muted)]">· {m.list}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
};
