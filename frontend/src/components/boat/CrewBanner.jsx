import { Users } from "lucide-react";

export const CrewBanner = ({ boat, owner }) => (
  <div className="flex items-start gap-3 rounded-lg border-[1.5px] border-sky-200 bg-sky-50 p-3.5 text-sm leading-relaxed text-sky-950" data-testid="crew-banner">
    <Users className="mt-0.5 h-5 w-5 shrink-0" />
    <p>
      <b data-testid="crew-banner-vessel">{boat.vessel || "Shared boat"}</b>{boat.callsign && <> · Callsign <b className="font-mono">{boat.callsign}</b></>}
      <br />You&apos;re crew{owner && <> on {owner}&apos;s boat</>}. You can tick items; the skipper looks after everything else.
    </p>
  </div>
);
