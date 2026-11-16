import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GraduationCap, MailX } from "lucide-react";

// Asked before Help > Model Vessel > Basic Introduction Walkthrough switches away from the skipper's own boat.
export const ModelWalkthroughConfirm = ({ open, title, from, onConfirm, onClose }) => (
  <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent className="max-w-sm rounded-lg border-2 border-emerald-700" data-testid="model-walkthrough-confirm">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold text-emerald-800"><GraduationCap className="h-5 w-5" /> Switch to the Model Vessel?</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="flex flex-col gap-2 text-left text-sm text-[var(--navy)]">
            <p data-testid="model-walkthrough-switch-note">The {title || "Basic Introduction Walkthrough"}{/walkthrough$/i.test(title || "walkthrough") ? "" : " walkthrough"} runs on the Model Vessel, a practice boat. It&apos;s easy to switch back: pick {from || "your boat"} from the boat list at the top at any time.</p>
            <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 font-bold text-amber-900" data-testid="model-walkthrough-email-note"><MailX className="mt-0.5 h-4 w-4 shrink-0" /> No emails or messages go out from the Model Vessel, so nothing you try there reaches anyone.</p>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid="model-walkthrough-cancel-btn">Stay here</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="!bg-emerald-700" data-testid="model-walkthrough-switch-btn">Switch and start</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
