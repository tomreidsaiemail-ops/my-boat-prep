import { useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2, Mail, MessageCircle, ShoppingCart } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { aisleShopping, shoppingMessage } from "@/lib/shoppers";
import { ShoppingStatus } from "@/components/boat/crew/CrewFacts";
import { ShopPeekDialog } from "@/components/boat/crew/ShopPeekDialog";

const BTN = "btn-ghost h-8 gap-1 bg-white px-2 text-xs";

// A crew member's Trip Shopping List (the aisles given to them), grouped in grey: email it, copy it for WhatsApp, or peek at it.
export const SendShoppingButton = ({ boat, vessel, person, sent, shopRows, online, testId }) => {
  const { user } = useAuth();
  const skipper = user.name || user.email;
  const [busy, setBusy] = useState(false);
  const [peek, setPeek] = useState(false);
  const groups = aisleShopping(shopRows, person.name);
  const items = groups.flatMap((g) => g.items);
  if (!items.length) return null;
  const email = async () => {
    setBusy(true);
    try {
      await api.post(`/boats/${boat.boat_id}/crew/shopping`, { email: person.email, name: person.name, items, groups }, { timeout: 20000 });
      toast.success(`Shopping list emailed to ${person.name}`);
    } catch (e) { toast.error(apiError(e, "Couldn't send the shopping list")); }
    setBusy(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shoppingMessage({ vessel, skipper, name: person.name, items, groups })); toast.success("Shopping list copied, paste it into WhatsApp"); }
    catch { toast.error("Copying isn't allowed here"); }
  };
  return (
    <div className="mt-1.5 flex flex-col gap-1 rounded-lg border-[1.5px] border-slate-300 bg-slate-100 p-2" data-testid={`${testId}-shopping-group`}>
      <p className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid={`${testId}-shopping-title`}>
        <ShoppingCart className="h-3.5 w-3.5" /> Trip Shopping List ({items.length})
      </p>
      <ShoppingStatus sent={sent} items={items} aisles={groups.map((g) => g.aisle)} testId={testId} />
      <div className="mt-0.5 flex flex-wrap gap-1.5">
        <button type="button" className={BTN} onClick={email} disabled={busy || !online || !person.email} data-testid={`${testId}-shopping-email-btn`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Send email
        </button>
        <button type="button" className={BTN} onClick={copy} data-testid={`${testId}-shopping-copy-btn`}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp Copy</button>
        <button type="button" className={BTN} onClick={() => setPeek(true)} data-testid={`${testId}-shopping-peek-btn`}><Eye className="h-3.5 w-3.5" /> Peek...</button>
      </div>
      <ShopPeekDialog open={peek} name={person.name} groups={groups} onClose={() => setPeek(false)} />
    </div>
  );
};
