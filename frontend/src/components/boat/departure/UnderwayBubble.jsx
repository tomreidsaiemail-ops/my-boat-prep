import { Sailboat } from "lucide-react";

const since = (at) => { try { return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; } };

// Shown under VESSEL (big) and on the Leaving the Dock route summary until ARRIVED, ALL CHECKS DONE.
export const UnderwayBubble = ({ underway, big = false, testId = "underway-bubble" }) => (
  <span className={`inline-flex max-w-full items-center gap-1.5 self-start rounded-full bg-emerald-700 ${big ? "px-4 py-1.5 text-sm shadow-md" : "px-3 py-1 text-xs"} font-extrabold uppercase tracking-wider text-white`} data-testid={testId}>
    <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-white" /></span>
    <Sailboat className="h-3.5 w-3.5 shrink-0" />
    <span className="truncate">Underway{underway.at ? <span className="font-semibold normal-case tracking-normal"> since {since(underway.at)}</span> : null}</span>
  </span>
);
