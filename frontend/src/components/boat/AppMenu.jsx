import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightLeft, FileDown, FileSpreadsheet, FileText, FileUp, Files, Fish, Lock, RotateCcw, Inbox, HelpCircle, Martini, Menu, MessageSquarePlus, QrCode, RefreshCw, ShoppingBasket, TableProperties } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FeedbackDialog } from "@/components/boat/FeedbackDialog";
import { ShareAppDialog } from "@/components/boat/ShareAppDialog";
import { Cascade, HelpDialog, HelpSubMenu, helpMenuItems } from "@/components/boat/HelpMenu";
import { useMenuOpen } from "@/lib/glow";

export const AppMenu = ({ onOpenFaq, onBartender, onFish, onShopScan, onSyncStores, onBuilder, onImport, helpPanels, onModelWalkthrough, wizards, onTransfer, onRequestTransfer, welcome, listTools }) => {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [help, setHelp] = useState(null);
  const [open, setOpen] = useState(false);
  useMenuOpen("menu", setOpen);
  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Menu" data-testid="app-menu-btn"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-[var(--navy)] bg-white text-[var(--navy)] [transition:background-color_.15s,transform_.1s] hover:bg-slate-50 active:scale-95">
            <Menu className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[80] w-72" data-testid="app-menu">
          {(onBartender || onFish || onShopScan || onSyncStores || onBuilder || onImport || listTools) && <>
            {onBartender && <DropdownMenuItem onSelect={onBartender} data-testid="app-menu-bartender-item"><Martini className="mr-2 h-4 w-4" />Magic Bartender</DropdownMenuItem>}
            {onFish && <DropdownMenuItem onSelect={onFish} data-testid="app-menu-fish-item"><Fish className="mr-2 h-4 w-4" />Magic Fish Whisperer...</DropdownMenuItem>}
            {onShopScan && <DropdownMenuItem onSelect={onShopScan} data-testid="app-menu-shop-scan-item"><ShoppingBasket className="mr-2 h-4 w-4" />Batch Magic Scan My Shopping...</DropdownMenuItem>}
            {onSyncStores && <DropdownMenuItem onSelect={onSyncStores} data-testid="app-menu-sync-stores-item"><RefreshCw className="mr-2 h-4 w-4" />Sync Food &amp; Drink Cupboards Magically...</DropdownMenuItem>}
            {onBuilder && <DropdownMenuItem onSelect={onBuilder} data-testid="app-menu-builder-item"><TableProperties className="mr-2 h-4 w-4" />Custom Attribute List Builder...</DropdownMenuItem>}
            {listTools && <DropdownMenuItem onSelect={listTools.reset} data-testid="app-menu-reset-all-item"><RotateCcw className="mr-2 h-4 w-4" />Reset all...</DropdownMenuItem>}
            {(listTools || onImport) && (
              <Cascade title="Export/Import" icon={FileDown} testId="app-menu-export-import">
                {listTools && <>
                  <DropdownMenuItem onSelect={listTools.exportCurrent} className="pl-3" data-testid="app-menu-export-current-item"><FileDown className="mr-2 h-4 w-4" />Export Current</DropdownMenuItem>
                  <DropdownMenuItem onSelect={listTools.exportAll} className="pl-3" data-testid="app-menu-export-all-item">{listTools.locked ? <Lock className="mr-2 h-4 w-4" /> : <Files className="mr-2 h-4 w-4" />}Export All</DropdownMenuItem>
                  <DropdownMenuItem onSelect={listTools.excel} className="pl-3" data-testid="app-menu-export-excel-item"><FileSpreadsheet className="mr-2 h-4 w-4 text-[#1D6F42]" />Export to Excel...</DropdownMenuItem>
                </>}
                {onImport && <DropdownMenuItem onSelect={onImport} className="pl-3" data-testid="app-menu-import-item"><FileUp className="mr-2 h-4 w-4" />Import Spreadsheet...</DropdownMenuItem>}
              </Cascade>
            )}
            <DropdownMenuSeparator className={onRequestTransfer ? "my-1.5 h-[2px] bg-[var(--navy)]" : ""} data-testid="app-menu-bartender-separator" />
          </>}
          {onRequestTransfer && <>
            {onTransfer && <DropdownMenuItem onSelect={onTransfer} data-testid="app-menu-transfer-item"><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer ownership...</DropdownMenuItem>}
            <DropdownMenuItem onSelect={onRequestTransfer} className={onTransfer ? "pl-8" : ""} data-testid="app-menu-request-transfer-item"><Inbox className="mr-2 h-4 w-4" />Request Ownership Transfer...</DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5 h-[2px] bg-[var(--navy)]" data-testid="app-menu-transfer-separator" />
          </>}
          <HelpSubMenu items={helpMenuItems(helpPanels)} onPick={setHelp} onModelWalkthrough={onModelWalkthrough} wizards={wizards} welcome={welcome} />
          <DropdownMenuItem onSelect={onOpenFaq} data-testid="app-menu-faq-item"><HelpCircle className="mr-2 h-4 w-4" />FAQ</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFeedback(true)} data-testid="app-menu-feedback-item"><MessageSquarePlus className="mr-2 h-4 w-4" />Submit feedback...</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSharing(true)} data-testid="app-menu-share-item"><QrCode className="mr-2 h-4 w-4" />Share the app</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/terms")} data-testid="app-menu-terms-item"><FileText className="mr-2 h-4 w-4" />Terms of Service</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FeedbackDialog open={feedback} onClose={() => setFeedback(false)} />
      <ShareAppDialog open={sharing} onClose={() => setSharing(false)} />
      <HelpDialog help={help} onClose={() => setHelp(null)} />
    </>
  );
};
