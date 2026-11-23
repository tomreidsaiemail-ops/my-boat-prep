import { useEffect, useState } from "react";
import { ChevronRight, Sailboat } from "lucide-react";

const since = (at) => { try { return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; } };

// "45 min", "3 h 20 min", "2 d 4 h"
export const elapsed = (at, now = Date.now()) => {
  const mins = Math.max(0, Math.floor((now - new Date(at).getTime()) / 60000));
  if (Number.isNaN(mins)) return "";
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d) return `${d} d ${h} h`;
  return h ? `${h} h ${m} min` : `${m} min`;
};

const useMinute = (on) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [on]);
  return now;
};

// Shown under VESSEL (big, tap to open the live track map) and on the Leaving the Dock route summary until ARRIVED, ALL CHECKS DONE.
// next: a small tappable "Next: Arriving at Destination" badge beside it ({ label, onClick }).
export const UnderwayBubble = ({ underway, big = false, onOpen, testId = "underway-bubble", next = null }) => {
  const now = useMinute(!!underway.at);
  const Tag = onOpen ? "button" : "span";
  const bubble = (
    <Tag type={onOpen ? "button" : undefined} onClick={onOpen} aria-label={onOpen ? "Underway: open the live track map" : undefined}
      className={`inline-flex max-w-full items-center gap-1.5 self-start rounded-full bg-emerald-700 ${big ? "px-4 py-1.5 text-sm shadow-md" : "px-3 py-1 text-xs"} font-extrabold uppercase tracking-wider text-white ${onOpen ? "hover:bg-emerald-800 active:scale-[.98] [transition:background-color_.15s,transform_.1s]" : ""}`} data-testid={testId}>
      <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-white" /></span>
      <Sailboat className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">Underway{underway.at ? (
        <span className="font-semibold normal-case tracking-normal"> <b className="font-extrabold" data-testid={`${testId}-elapsed`}>{elapsed(underway.at, now)}</b> · since {since(underway.at)}</span>
      ) : null}</span>
      {onOpen && <ChevronRight className="h-4 w-4 shrink-0" />}
    </Tag>
  );
  if (!next) return bubble;
  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5 self-start" data-testid={`${testId}-wrap`}>
      {bubble}
      <button type="button" onClick={next.onClick} className="inline-flex items-center gap-0.5 rounded-full border-[1.5px] border-emerald-700 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100 active:scale-95 [transition:background-color_.15s,transform_.1s]"
        data-testid={`${testId}-next`}>{next.label} <ChevronRight className="h-3.5 w-3.5 shrink-0" /></button>
    </div>
  );
};
