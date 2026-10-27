import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, HelpCircle, Menu, MessageSquarePlus, QrCode } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FeedbackDialog } from "@/components/boat/FeedbackDialog";
import { ShareAppDialog } from "@/components/boat/ShareAppDialog";

export const AppMenu = ({ onOpenFaq }) => {
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
        <DropdownMenuContent align="end" className="w-56" data-testid="app-menu">
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
