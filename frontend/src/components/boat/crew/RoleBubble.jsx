import { Check, Circle, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { localWhen } from "@/lib/timeAgo";

const status = (b, who, joined) => {
  if (!b.has_briefing) return { tone: "bg-sky-100 text-sky-900", Icon: null, text: `No Role Briefing for ${b.role} yet. Add one in your Crew Roles list.` };
  if (!joined) return { tone: "bg-amber-100 text-amber-900 ring-1 ring-amber-300", Icon: Circle, text: `The ${b.role} briefing is in ${who}'s invite email. They confirm they've read it after they join.` };
  if (b.read_at) return { tone: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300", Icon: Check, text: `${who} has read the ${b.role} briefing (${localWhen(b.read_at)}).` };
  if (b.read_old) return { tone: "bg-amber-100 text-amber-900 ring-1 ring-amber-300", Icon: Circle, text: `The ${b.role} briefing changed after ${who} read it, so they need to read it again.` };
  return { tone: "bg-amber-100 text-amber-900 ring-1 ring-amber-300", Icon: Circle, text: `${who} hasn't confirmed reading the ${b.role} briefing yet.` };
};

// A crew member's role: tap (or hover) to see whether they know about its Role Briefing.
export const RoleBubble = ({ b, who, joined, testId }) => {
  const s = status(b, who, joined);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" title={s.text} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.tone}`} data-testid={testId}
          data-read={b.read_at ? "yes" : "no"}>
          {s.Icon && <s.Icon className={`h-3 w-3 ${s.Icon === Circle ? "fill-current" : ""}`} strokeWidth={3} />}{b.role}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-sm" data-testid={`${testId}-info`}>
        <p className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--navy)]" />{s.text}</p>
      </PopoverContent>
    </Popover>
  );
};
