import { CheckCircle2 } from "lucide-react";

// A quiet "SMS delivered" tick where the Confirm line was; nothing shows while sending or if it failed, so the VHF call comes first.
export const DistressSmsTick = ({ sms }) => {
  if (sms?.status !== "delivered") return null;
  return (
    <p className="flex items-center gap-1 self-start text-xs font-bold text-emerald-800" data-testid="distress-sms-tick">
      <CheckCircle2 className="h-4 w-4 text-[var(--green)]" /> SMS delivered to {sms.total > 1 ? `${sms.delivered} of ${sms.total} shore contacts` : "shore contact"}
    </p>
  );
};
