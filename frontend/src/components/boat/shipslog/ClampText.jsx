import { useLayoutEffect, useRef } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

// Ship's Log rows clamp to 3 lines; tells the row when its text is long enough to need the expand toggle.
export const ClampText = ({ on, open, title, onLong, children, className, testId }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || open || !el) return undefined;
    const check = () => onLong(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [on, open, children]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={ref} className={`${className} ${on && !open ? "line-clamp-3" : ""}`} title={on && !open ? title : undefined} data-testid={testId} data-clamped={on && !open ? "true" : "false"}>
      {children}
    </span>
  );
};

export const ExpandButton = ({ id, open, onToggle }) => (
  <button type="button" className="icon-btn" onClick={onToggle} aria-expanded={open} aria-label={open ? "Show 3 lines" : "Show the full entry"} title={open ? "Collapse" : "Expand"}
    data-testid={`checklist-item-expand-${id}`}>
    {open ? <ChevronsDownUp className="h-[18px] w-[18px]" /> : <ChevronsUpDown className="h-[18px] w-[18px]" />}
  </button>
);

export const ExpandAllButton = ({ anyOpen, onAll }) => (
  <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={() => onAll(!anyOpen)} aria-pressed={anyOpen} data-testid="log-expand-all-btn">
    {anyOpen ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
    {anyOpen ? "Collapse all log rows" : "Expand all log rows"}
  </button>
);
