import { Star } from "lucide-react";

export const Stars = ({ value = 0, onPick, size = "h-7 w-7", testId = "stars" }) => (
  <div className="flex gap-1" role={onPick ? "radiogroup" : "img"} aria-label={`${value} of 5 stars`} data-testid={testId}>
    {[1, 2, 3, 4, 5].map((n) => {
      const icon = <Star className={`${size} ${n <= value ? "fill-amber-400 text-amber-500" : "text-slate-300"}`} strokeWidth={1.8} />;
      return onPick
        ? <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => onPick(n)}
            className="rounded [transition:transform_.12s] hover:scale-110" data-testid={`${testId}-${n}`}>{icon}</button>
        : <span key={n}>{icon}</span>;
    })}
  </div>
);
