import { toast } from "sonner";
import { Ticket } from "lucide-react";
import { JOINCREW_OFFER } from "@/lib/joincrew";

// Shown to crew who haven't used JOINCREW yet: start their own Pro plan at a discount and reward their skipper.
export const JoinCrewOffer = ({ testId = "agreement-joincrew-offer" }) => (
  <div className="flex items-start gap-2.5 rounded-md border-[1.5px] border-sky-300 bg-sky-50 p-3 text-sm text-sky-950" data-testid={testId}>
    <Ticket className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
    <p><b>Got a boat of your own?</b> {JOINCREW_OFFER}. Enter it when you upgrade to Pro.</p>
  </div>
);

export const offerToast = () => toast.message("Got a boat of your own?", {
  description: `${JOINCREW_OFFER}. Enter it when you upgrade to Pro.`, duration: 12000, icon: <Ticket className="h-4 w-4 text-sky-700" />,
});
