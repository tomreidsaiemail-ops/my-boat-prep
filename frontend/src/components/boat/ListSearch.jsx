import { Search, X } from "lucide-react";

// Reference lists (Books and eBooks, Education Videos, Latest Tech Videos...) get a search box, like FAQ and Skipper's Tips.
export const searchableList = (name) => /book|video/i.test(name || "");

export const ListSearch = ({ value, onChange, shown, total, placeholder = "Search this list", testId = "list-search" }) => (
  <div className="flex flex-col gap-1">
    <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-[var(--navy)] bg-white px-3" data-testid={testId}>
      <Search className="h-5 w-5 shrink-0 text-[var(--navy)]" />
      <input type="text" enterKeyHint="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none" data-testid={`${testId}-input`} />
      {value && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => onChange("")} data-testid={`${testId}-clear`}><X className="h-5 w-5" /></button>}
    </label>
    {value.trim() && <p className="text-sm font-semibold text-[var(--muted)]" data-testid={`${testId}-summary`}>{shown ? `${shown} of ${total} match "${value.trim()}"` : `Nothing matches "${value.trim()}"`}</p>}
  </div>
);
