import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShoppingBasket } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { shoppingFor, shoppingMessage } from "@/lib/shoppers";

// Emails (or copies for WhatsApp) the Provisions a crew member is buying.
export const SendShoppingButton = ({ boat, vessel, person, provisions, online, testId }) => {
  const { user } = useAuth();
  const skipper = user.name || user.email;
  const [busy, setBusy] = useState(false);
  const items = shoppingFor(provisions, person.name);
  if (!items.length) return null;
  const email = async () => {
    setBusy(true);
    try {
      await api.post(`/boats/${boat.boat_id}/crew/shopping`, { email: person.email, name: person.name, items }, { timeout: 20000 });
      toast.success(`Shopping list emailed to ${person.name}`);
    } catch (e) { toast.error(apiError(e, "Couldn't send the shopping list")); }
    setBusy(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shoppingMessage({ vessel, skipper, name: person.name, items })); toast.success("Shopping list copied, paste it into WhatsApp"); }
    catch { toast.error("Copying isn't allowed here"); }
  };
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <button type="button" className="btn-ghost h-8 gap-1 px-2 text-xs" onClick={email} disabled={busy || !online || !person.email} data-testid={`${testId}-shopping-email-btn`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBasket className="h-3.5 w-3.5" />} Send shopping list ({items.length})
      </button>
      <button type="button" className="btn-ghost h-8 gap-1 px-2 text-xs" onClick={copy} data-testid={`${testId}-shopping-copy-btn`}><ShoppingBasket className="h-3.5 w-3.5" /> Copy for WhatsApp</button>
    </div>
  );
};
