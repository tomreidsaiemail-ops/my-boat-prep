import { Ticket } from "lucide-react";
import { localWhen } from "@/lib/timeAgo";

// Skipper-only tick: this crew member used the JOINCREW code to start their own Pro plan.
export const JoinCrewBadge = ({ jc, testId }) => {
  if (!jc) return null;
  const tip = `Used the JOINCREW code to start their own Pro plan${jc.at ? ` ${localWhen(jc.at)}` : ""}${jc.rewarded && jc.reward ? `. You got +${jc.reward} Magic generations.` : ""}`;
  return (
    <span className="mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-sky-900" title={tip} aria-label={tip} data-testid={testId}>
      <Ticket className="h-3.5 w-3.5 text-sky-700" /> JOINCREW{jc.rewarded && jc.reward > 0 && <span className="normal-case tracking-normal" data-testid={`${testId}-reward`}>· +{jc.reward} Magic</span>}
    </span>
  );
};
