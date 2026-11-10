import { Sparkles, Wrench } from "lucide-react";

// The Magic Marine Engineer: a wrench with a magic sparkle.
export const MagicEngineerIcon = ({ className = "h-6 w-6", testId }) => (
  <span className={`relative inline-flex shrink-0 ${className}`} data-testid={testId} aria-hidden="true">
    <Wrench className="h-full w-full" strokeWidth={2.2} />
    <Sparkles className="absolute -right-1.5 -top-1.5 h-1/2 w-1/2 fill-amber-300 text-amber-500" strokeWidth={2.2} />
  </span>
);
