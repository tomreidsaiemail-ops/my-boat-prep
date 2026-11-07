import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FileUp, Fish, HelpCircle, Martini, Menu, MessageSquarePlus, QrCode, RefreshCw, ShoppingBasket, TableProperties } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FeedbackDialog } from "@/components/boat/FeedbackDialog";
import { ShareAppDialog } from "@/components/boat/ShareAppDialog";

export const AppMenu = ({ onOpenFaq, onBartender, onFish, onShopScan, onSyncStores, onBuilder, onImport }) => {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(false);
  const [sharing, setSharing] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Menu" data-testid="app-menu-btn"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-[var(--navy)] bg-white text-[var(--navy)] [transition:background-color_.15s,transform_.1s] hover:bg-slate-50 active:scale-95">
            <Menu className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72" data-testid="app-menu">
          {(onBartender || onFish || onShopScan || onSyncStores || onBuilder || onImport) && <>
            {onBartender && <DropdownMenuItem onSelect={onBartender} data-testid="app-menu-bartender-item"><Martini className="mr-2 h-4 w-4" />Magic Bartender</DropdownMenuItem>}
            {onFish && <DropdownMenuItem onSelect={onFish} data-testid="app-menu-fish-item"><Fish className="mr-2 h-4 w-4" />Magic Fish Whisperer...</DropdownMenuItem>}
            {onShopScan && <DropdownMenuItem onSelect={onShopScan} data-testid="app-menu-shop-scan-item"><ShoppingBasket className="mr-2 h-4 w-4" />Batch Magic Scan My Shopping...</DropdownMenuItem>}
            {onSyncStores && <DropdownMenuItem onSelect={onSyncStores} data-testid="app-menu-sync-stores-item"><RefreshCw className="mr-2 h-4 w-4" />Sync Food &amp; Drink Boat Areas Magically...</DropdownMenuItem>}
            {onBuilder && <DropdownMenuItem onSelect={onBuilder} data-testid="app-menu-builder-item"><TableProperties className="mr-2 h-4 w-4" />Custom Attribute List Builder...</DropdownMenuItem>}
            {onImport && <DropdownMenuItem onSelect={onImport} data-testid="app-menu-import-item"><FileUp className="mr-2 h-4 w-4" />Import Spreadsheet...</DropdownMenuItem>}
            <DropdownMenuSeparator data-testid="app-menu-bartender-separator" />
          </>}
          <DropdownMenuItem onSelect={onOpenFaq} data-testid="app-menu-faq-item"><HelpCircle className="mr-2 h-4 w-4" />FAQ</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFeedback(true)} data-testid="app-menu-feedback-item"><MessageSquarePlus className="mr-2 h-4 w-4" />Submit feedback...</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSharing(true)} data-testid="app-menu-share-item"><QrCode className="mr-2 h-4 w-4" />Share the app</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/terms")} data-testid="app-menu-terms-item"><FileText className="mr-2 h-4 w-4" />Terms of Service</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FeedbackDialog open={feedback} onClose={() => setFeedback(false)} />
      <ShareAppDialog open={sharing} onClose={() => setSharing(false)} />
    </>
  );
};
