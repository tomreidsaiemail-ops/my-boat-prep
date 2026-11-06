import { AlertTriangle } from "lucide-react";
import { dietPeople, real, useCrewDiet } from "@/lib/crewDiet";

// Crew allergies and food preferences, shown on meal plans, provisions and in the Magic Provisioning Assistant.
export const DietBanner = ({ testId = "diet-banner" }) => {
  const diet = useCrewDiet();
  const people = dietPeople(diet?.people);
  if (!people.length) return null;
  return (
    <div role="note" className="flex flex-col gap-1.5 rounded-lg border-2 border-amber-400 bg-amber-50 p-3" data-testid={testId}>
      <p className="flex items-center gap-2 text-sm font-extrabold text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" /> Crew allergies and food preferences</p>
      <ul className="flex flex-col gap-1 text-sm">
        {people.map((p, i) => (
          <li key={`${p.name}-${i}`} data-testid={`${testId}-person-${i}`}>
            <b>{p.name}:</b>{" "}
            {real(p.allergies) && <span className="font-bold text-[var(--red)]" data-testid={`${testId}-allergy-${i}`}>Allergic to {p.allergies}</span>}
            {real(p.allergies) && real(p.food) && " · "}
            {real(p.food) && <span data-testid={`${testId}-food-${i}`}>Prefers {p.food}</span>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-900/80">From Crew Registration for crew on this boat{diet.rsvp_only ? " who replied they're in" : ""}. Magic meal ideas and the shopping list avoid these allergies.</p>
    </div>
  );
};
