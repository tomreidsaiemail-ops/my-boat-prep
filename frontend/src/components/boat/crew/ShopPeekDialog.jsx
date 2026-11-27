import { ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// A crew member's Trip Shopping List, aisle by aisle, just as they'll get it.
export const ShopPeekDialog = ({ open, name, groups, onClose }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="shop-peek-dialog">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><ShoppingCart className="h-5 w-5" /> {name ? `${name}'s shopping` : "Shopping"}</DialogTitle>
        <DialogDescription>From the Trip Shopping List, aisle by aisle.</DialogDescription>
      </DialogHeader>
      {groups.map((g, n) => (
        <div key={g.aisle} data-testid={`shop-peek-aisle-${n}`}>
          <p className="text-sm font-extrabold text-[var(--navy)]">{g.aisle} ({g.items.length})</p>
          <ul className="mt-0.5 list-disc pl-5 text-sm">{g.items.map((t, k) => <li key={k}>{t}</li>)}</ul>
        </div>
      ))}
    </DialogContent>
  </Dialog>
);
