import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, GraduationCap, HelpCircle, Route, Sparkles } from "lucide-react";
import { LinkedText } from "@/components/boat/LinkedText";

const PREFIX = /^\s*admin\s*-\s*help panel\s*-\s*/i;
const TITLES = { "batch magic scan button": "Batch Magic Scan..." };
const titleOf = (name) => {
  const rest = name.replace(PREFIX, "").replace(/\s+/g, " ").trim();
  return TITLES[rest.toLowerCase()] || `${rest.replace(/\b\w/g, (c) => c.toUpperCase())}...`;
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const GROUPS = [
  { title: "Route Planning and getting underway", icon: Route, names: ["mmn routing guidance", "planning routes and inviting crew", "ignore 300 metre warning", "ships log passage folders"] },
  { title: "Magic Features", icon: Sparkles, names: ["batch magic scan button", "magic bartender", "magic fish whisperer"] },
];
const keyOf = (name) => name.replace(PREFIX, "").replace(/\s+/g, " ").trim().toLowerCase();

// Help > the grouped cascades first (in the order above), then every other admin "Help Panel" list A-Z.
export const helpMenuItems = (panels = []) => {
  const all = panels.filter((p) => p.items?.length).map((p) => ({ key: keyOf(p.name), title: titleOf(p.name), items: p.items }));
  const grouped = new Set(GROUPS.flatMap((g) => g.names));
  return {
    groups: GROUPS.map((g) => ({ ...g, items: g.names.map((n) => all.find((h) => h.key === n)).filter(Boolean) })).filter((g) => g.items.length),
    rest: all.filter((h) => !grouped.has(h.key)).sort((a, b) => a.title.localeCompare(b.title)),
  };
};

const Cascade = ({ title, icon: Icon, testId, tone = "border-[var(--line)]", children }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(!open); }} aria-expanded={open} className="pl-3" data-testid={`${testId}-item`}>
        <Icon className="mr-2 h-4 w-4 shrink-0" />{title}<ChevronDown className={`ml-auto h-4 w-4 shrink-0 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </DropdownMenuItem>
      {open && <div className={`ml-6 border-l-2 ${tone}`} data-testid={`${testId}-submenu`}>{children}</div>}
    </>
  );
};

const Pick = ({ h, onPick }) => <DropdownMenuItem onSelect={() => onPick(h)} className="pl-3" data-testid={`app-menu-help-${slug(h.title)}`}>{h.title}</DropdownMenuItem>;

export const HelpSubMenu = ({ items: { groups = [], rest = [] } = {}, onPick, onModelWalkthrough, wizards = [] }) => {
  const [open, setOpen] = useState(false);
  if (!groups.length && !rest.length && !(onModelWalkthrough && wizards.length)) return null;
  // Opens downwards inside the menu, so the cascade fits on a phone screen.
  return (
    <>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(!open); }} aria-expanded={open} data-testid="app-menu-help-item">
        <HelpCircle className="mr-2 h-4 w-4" />Help<ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </DropdownMenuItem>
      {open && (
        <div className="ml-6 border-l-2 border-[var(--line)]" data-testid="app-menu-help-submenu">
          {groups.map((g) => (
            <Cascade key={g.title} title={g.title} icon={g.icon} testId={`app-menu-help-group-${slug(g.title)}`}>
              {g.items.map((h) => <Pick key={h.title} h={h} onPick={onPick} />)}
            </Cascade>
          ))}
          {rest.map((h) => <Pick key={h.title} h={h} onPick={onPick} />)}
          {onModelWalkthrough && wizards.length > 0 && (
            <Cascade title="Model Vessel" icon={GraduationCap} testId="app-menu-help-model-vessel" tone="border-emerald-200">
              {wizards.map((w) => <DropdownMenuItem key={w.key} onSelect={() => onModelWalkthrough(w)} className="pl-3" data-testid={`app-menu-help-model-wizard-${slug(w.title)}`}>{w.title}...</DropdownMenuItem>)}
            </Cascade>
          )}
        </div>
      )}
    </>
  );
};

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
