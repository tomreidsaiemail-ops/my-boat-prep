import { DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import { LinkedText } from "@/components/boat/LinkedText";

const PREFIX = /^\s*admin\s*-\s*help panel\s*-\s*/i;
const TITLES = { "batch magic scan button": "Batch Magic Scan..." };
const titleOf = (name) => {
  const rest = name.replace(PREFIX, "").replace(/\s+/g, " ").trim();
  return TITLES[rest.toLowerCase()] || `${rest.replace(/\b\w/g, (c) => c.toUpperCase())}...`;
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Help > every admin "Help Panel" list, Batch Magic Scan first.
export const helpMenuItems = (panels = []) => panels.filter((p) => p.items?.length).map((p) => ({ title: titleOf(p.name), items: p.items }))
  .sort((a, b) => (a.title.startsWith("Batch Magic Scan") ? -1 : b.title.startsWith("Batch Magic Scan") ? 1 : a.title.localeCompare(b.title)));

export const HelpSubMenu = ({ items, onPick }) => (items.length ? (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger data-testid="app-menu-help-item"><HelpCircle className="mr-2 h-4 w-4" />Help</DropdownMenuSubTrigger>
    <DropdownMenuSubContent className="max-h-[70vh] w-64 overflow-y-auto" data-testid="app-menu-help-submenu">
      {items.map((h) => <DropdownMenuItem key={h.title} onSelect={() => onPick(h)} data-testid={`app-menu-help-${slug(h.title)}`}>{h.title}</DropdownMenuItem>)}
    </DropdownMenuSubContent>
  </DropdownMenuSub>
) : null);

export const HelpDialog = ({ help, onClose }) => (
  <Dialog open={!!help} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="help-dialog">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold" data-testid="help-dialog-title"><HelpCircle className="h-5 w-5" /> Help: {help?.title.replace(/\.\.\.$/, "")}</DialogTitle>
        <DialogDescription className="sr-only">How this part of My Boat Prep works</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-800">
        {(help?.items || []).map((i, k) => (
          <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : ""} data-testid={`help-dialog-line-${k}`}><LinkedText text={i.label} testId={`help-dialog-link-${k}`} /></p>
        ))}
      </div>
      <button type="button" className="btn-solid h-11 justify-center" onClick={onClose} data-testid="help-dialog-done-btn">Done</button>
    </DialogContent>
  </Dialog>
);
