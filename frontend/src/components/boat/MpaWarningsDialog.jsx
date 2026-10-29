import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const MpaWarningsDialog = ({ warnings, onBack, onProceed }) => (
  <AlertDialog open={!!warnings} onOpenChange={(o) => !o && onBack()}>
    <AlertDialogContent className="max-w-sm rounded-lg border-2 border-amber-400" data-testid="mpa-warnings-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><AlertTriangle className="h-5 w-5 text-amber-500" /> Check your meal plan</AlertDialogTitle>
        <AlertDialogDescription>You can still make the shopping list if this is what you meant.</AlertDialogDescription>
      </AlertDialogHeader>
      <ul className="flex flex-col gap-2">
        {(warnings || []).map((w) => (
          <li key={w.id} className="rounded-md bg-amber-50 p-3 text-sm font-medium" data-testid={`mpa-warning-${w.id}`}>{w.text}</li>
        ))}
      </ul>
      <AlertDialogFooter className="flex-row justify-end gap-2">
        <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="mpa-warnings-back-btn">Go back</AlertDialogCancel>
        <AlertDialogAction className="btn-solid px-5" onClick={onProceed} data-testid="mpa-warnings-proceed-btn">Make it anyway</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
