import { ChevronDown, ChevronRight, FolderClosed, FolderOpen, Layers, Pencil, Ungroup } from "lucide-react";
import { rangeText } from "@/lib/logFolders";

// A passage or year folder in the Ship's Log: tap to open or close, rename, or ungroup.
export const LogFolderRow = ({ item, depth, count, logs, onOpen, onEdit, onUngroup, readOnly }) => {
  const Icon = item.folder === "year" ? Layers : item.open ? FolderOpen : FolderClosed;
  const btn = `icon-btn ${item.folder === "year" ? "!text-white hover:!bg-white/15" : ""}`;
  return (
    <li className={`flex items-stretch border-b border-[var(--line)] ${item.folder === "year" ? "bg-[var(--navy)] text-white" : "bg-sky-50"}`} data-testid={`log-folder-${item.id}`} data-open={item.open ? "true" : "false"}>
      {depth > 0 && <div className="shrink-0" style={{ width: depth * 18 }} aria-hidden="true" />}
      <button type="button" onClick={() => onOpen(!item.open)} aria-expanded={!!item.open} data-testid={`log-folder-toggle-${item.id}`}
        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left">
        {item.open ? <ChevronDown className="h-5 w-5 shrink-0" /> : <ChevronRight className="h-5 w-5 shrink-0" />}
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="font-extrabold" data-testid={`log-folder-name-${item.id}`}>{item.label}</span>
          <span className={`text-xs ${item.folder === "year" ? "text-white/80" : "text-[var(--muted)]"}`} data-testid={`log-folder-count-${item.id}`}>
            {logs !== null && logs !== undefined ? `${logs} ${logs === 1 ? "log" : "logs"} in ${count} ${count === 1 ? "item" : "items"}` : `${count} ${count === 1 ? "entry" : "entries"}`}{item.folder === "passage" && rangeText(item.from, item.to) ? ` · ${rangeText(item.from, item.to)}` : ""}
          </span>
        </span>
      </button>
      {!readOnly && (
        <div className="flex shrink-0 items-center pr-1">
          <button type="button" className={btn} onClick={onEdit} aria-label={`Rename ${item.label}`} data-testid={`log-folder-rename-${item.id}`}><Pencil className="h-4 w-4" /></button>
          <button type="button" className={btn} onClick={onUngroup} aria-label={`Ungroup ${item.label}`} title="Ungroup" data-testid={`log-folder-ungroup-${item.id}`}><Ungroup className="h-4 w-4" /></button>
        </div>
      )}
    </li>
  );
};
