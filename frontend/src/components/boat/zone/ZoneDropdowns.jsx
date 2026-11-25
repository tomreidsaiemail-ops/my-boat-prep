import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ZONE_COLOURS } from "@/lib/zoneColours";
import { ZONE_GROUPS } from "@/lib/zoneGroups";

const slug = (l) => l.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Add head / cabin / engine / other: pick a colour, then tap the plan. A ticked one is already on the plan; picking it again takes it off.
export const ZoneDropdowns = ({ presets, used, onPick, t }) => (
  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" data-testid={`${t}-add-zone-menus`}>
    {ZONE_GROUPS.map((g) => {
      const list = g.pick(presets);
      return (
        <DropdownMenu key={g.key} modal={false}>
          <DropdownMenuTrigger asChild disabled={!list.length}>
            <button type="button" className="flex h-10 items-center justify-between gap-1 rounded-md border-[1.5px] border-white/70 bg-white px-3 text-xs font-extrabold text-slate-900 disabled:opacity-50" data-testid={`${t}-add-${g.key}`}>
              {g.label} <ChevronDown className="h-4 w-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto" data-testid={`${t}-add-${g.key}-menu`}>
            {list.map((p) => {
              const on = used.has(p.label);
              return (
                <DropdownMenuItem key={p.label} onSelect={() => onPick(p, on)} className="gap-2 py-2 font-bold" data-testid={`${t}-add-${g.key}-${slug(p.label)}`}>
                  <span className="h-4 w-4 shrink-0 rounded-sm border border-black/20" style={{ background: ZONE_COLOURS[p.colour] }} />
                  <span className="flex-1">{p.label}</span>
                  {on && <Check className="h-4 w-4 text-[var(--green)]" data-testid={`${t}-add-${g.key}-${slug(p.label)}-placed`} />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    })}
  </div>
);

// "Add Zone to schematic window": the plan again with every colour, for anything unusual.
export const AddZoneWindow = ({ open, onClose, t, children }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-2xl flex-col gap-2 overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-3 [&>*]:shrink-0" data-testid={`${t}-window`} onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle className="font-display text-xl font-extrabold">Add Zone to schematic</DialogTitle>
        <DialogDescription className="text-left text-xs">Every zone colour, for anything unusual on your boat.</DialogDescription>
      </DialogHeader>
      {children}
      <button type="button" className="btn-solid h-11 shrink-0 justify-center" onClick={onClose} data-testid={`${t}-window-done`}>Done</button>
    </DialogContent>
  </Dialog>
);
