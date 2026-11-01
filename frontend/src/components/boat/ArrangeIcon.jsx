import { Wand2 } from "lucide-react";

// "Arrange Lists" icon: a square holding 4 coloured squares, next to the wand.
export const ArrangeIcon = () => (
  <span className="inline-flex shrink-0 items-center gap-0.5" aria-hidden="true" data-testid="arrange-lists-icon">
    <svg viewBox="0 0 16 16" className="h-4 w-4">
      <rect x="0.75" y="0.75" width="14.5" height="14.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3.25" y="3.25" width="4.25" height="4.25" rx="0.75" fill="#dc2626" />
      <rect x="8.5" y="3.25" width="4.25" height="4.25" rx="0.75" fill="#f59e0b" />
      <rect x="3.25" y="8.5" width="4.25" height="4.25" rx="0.75" fill="#059669" />
      <rect x="8.5" y="8.5" width="4.25" height="4.25" rx="0.75" fill="#0284c7" />
    </svg>
    <Wand2 className="h-4 w-4" />
  </span>
);
