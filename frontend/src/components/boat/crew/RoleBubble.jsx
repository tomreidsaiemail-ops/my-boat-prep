import { Check, Circle, FileText, PlayCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { localWhen } from "@/lib/timeAgo";

// The crew member's answer to the briefing video (same keys as the server's briefing_fill.VIDEO_CHOICES).
const VIDEO_TAG = { watched: "Watched video", will_watch: "Will watch video", no_time: "Won't watch video" };
const VIDEO_SHORT = { watched: "they have watched the briefing video", will_watch: "they will watch the briefing video before you leave", no_time: "they won't have time to watch the briefing video" };

const status = (b, who, joined) => {
  if (!b.has_briefing) return { tone: "bg-orange-300 text-orange-950", Icon: null, text: `No Role Briefing for ${b.role} yet. Add one in your Crew Roles list.` };
  if (!joined) return { tone: "bg-orange-300 text-orange-950", Icon: Circle, text: `The ${b.role} briefing is in ${who}'s invite email. They confirm they've read it after they join.` };
  if (b.read_at) return { tone: "bg-orange-300 text-orange-950 ring-2 ring-emerald-600", Icon: Check, text: `${who} has read the ${b.role} briefing (${localWhen(b.read_at)}).${b.video_choice ? ` Video: ${VIDEO_SHORT[b.video_choice]}.` : ""}` };
  if (b.read_old) return { tone: "bg-orange-300 text-orange-950", Icon: Circle, text: `The ${b.role} briefing changed after ${who} read it, so they need to read it again.` };
  return { tone: "bg-orange-300 text-orange-950", Icon: Circle, text: `${who} hasn't confirmed reading the ${b.role} briefing yet.` };
};

// A crew member's role (orange): tap (or hover) to see whether they know about its Role Briefing; a green ring and tick once read.
export const RoleBubble = ({ b, who, joined, testId }) => {
  const s = status(b, who, joined);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" title={s.text} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.tone}`} data-testid={testId}
          data-read={b.read_at ? "yes" : "no"}>
          {s.Icon && <s.Icon className={`h-3 w-3 ${s.Icon === Circle ? "fill-current" : ""}`} strokeWidth={3} />}{b.role}
          {b.read_at && b.video_choice && <span className={`ml-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 ${b.video_choice === "no_time" ? "bg-red-100 text-red-900" : "bg-white/70"}`} data-testid={`${testId}-video`}><PlayCircle className="h-3 w-3" />{VIDEO_TAG[b.video_choice]}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-sm" data-testid={`${testId}-info`}>
        <p className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--navy)]" />{s.text}</p>
      </PopoverContent>
    </Popover>
  );
};
