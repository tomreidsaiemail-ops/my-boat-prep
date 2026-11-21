import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DROPDOWN = { caption_label: "hidden", caption_dropdowns: "flex gap-1", dropdown: "rounded-md border border-[var(--line)] bg-white px-1 py-0.5 text-sm font-bold", vhidden: "hidden" };

// In-app calendar (the browser's own picker is blocked inside framed previews). Pass min/max "yyyy-mm-dd" to limit the range.
export const DatePopover = ({ value, onChange, min, max, label, testId, children, className = "" }) => {
  const [open, setOpen] = useState(false);
  const picked = value ? parseISO(value) : undefined;
  const pick = (d) => { setOpen(false); onChange(d ? format(d, "yyyy-MM-dd") : ""); };
  const bounded = min && max;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className={`block w-full text-left ${className}`} data-testid={testId}>{children}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" data-testid={`${testId}-popover`}>
        <Calendar mode="single" selected={picked} onSelect={pick} initialFocus
          defaultMonth={picked || (bounded ? parseISO(min) : undefined)}
          {...(bounded ? { fromDate: parseISO(min), toDate: parseISO(max) } : { captionLayout: "dropdown-buttons", fromYear: 1970, toYear: new Date().getFullYear() + 30, classNames: DROPDOWN })} />
        {value && (
          <div className="border-t border-[var(--line)] p-2">
            <button type="button" onClick={() => pick(null)} className="btn-ghost h-9 min-h-0 w-full text-xs" data-testid={`${testId}-clear-btn`}>Clear date</button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
