import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { api, openMagicBuy } from "@/lib/api";

// Free and bought Magic generations left, refreshed each time the account menu opens.
export const MagicBalance = ({ open }) => {
  const [q, setQ] = useState(null);
  useEffect(() => { if (open) api.get("/magic/quota").then(({ data }) => setQ(data)).catch(() => {}); }, [open]);
  return (
    <>
      <div className="px-2 py-1.5 text-xs" data-testid="magic-balance">
        <span className="flex items-center gap-1.5 font-extrabold"><Sparkles className="h-3.5 w-3.5 text-[var(--amber)]" /> Magic left</span>
        <span className="text-[var(--muted)]" data-testid="magic-balance-text">
          {q ? <><b className="text-[var(--navy)]">{q.free_left}</b> of {q.daily_limit} free today · <b className="text-[var(--navy)]">{q.purchased_allowance}</b> bought</> : "Checking..."}
        </span>
      </div>
      <DropdownMenuItem onSelect={openMagicBuy} data-testid="account-buy-magic-item"><Sparkles className="mr-2 h-4 w-4" />Buy more Magic</DropdownMenuItem>
    </>
  );
};
