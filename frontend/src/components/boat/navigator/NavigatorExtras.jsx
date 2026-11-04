import { AlertTriangle, BellRing } from "lucide-react";

export const NavigatorIntro = () => (
  <div className="flex flex-col gap-1.5 text-sm leading-snug" data-testid="navigator-intro">
    <p>The MAGIC MARINE NAVIGATOR recommends the use of some of the excellent weather and routing products available.</p>
    <p>Planning a suitable weather window for a passage is vital and these products excel in the complex area of weather routing and vessel routing.</p>
    <p>The MMN will give some general advice, however, use the weather and routing products and upload screen shots from them here to share with the crew who may not have these products or access to your account.</p>
  </div>
);

export const NavigatorReminders = () => (
  <ul className="flex flex-col gap-1.5 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="navigator-reminders">
    <li className="flex gap-2"><BellRing className="mt-0.5 h-4 w-4 shrink-0" /> When the weather reports update, check your weather and routing products again and upload fresh screenshots here.</li>
    <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Where available, monitor the AI polars of your chosen weather and routing products, so the routing matches how your boat really sails.</li>
  </ul>
);

export const WhyGoing = ({ value, onChange }) => (
  <label className="flex flex-col gap-1.5">
    <span className="field-label">Why we're going</span>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={1000} rows={3}
      placeholder="e.g. Window Tue 0600-1800: SW 15-20 kn easing, 1.5 m swell. Leave before the next front on Wed."
      className="field-input min-h-[80px] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="navigator-why-input" />
    <span className="text-xs text-[var(--muted)]">Logged in the Ship's Log with the photos when Departure is ticked on the Leaving Dock list.</span>
  </label>
);
