import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Asked on sign out when crew haven't told the skipper whether they're coming.
export const SignOutRsvpDialog = ({ ask, onDone, onClose }) => {
  const [busy, setBusy] = useState("");
  const answer = async (status) => {
    setBusy(status);
    const ok = await ask.send(status);
    setBusy("");
    if (ok) onDone();
  };
  const Btn = ({ status, icon: Icon, cls, children }) => (
    <button type="button" disabled={!!busy} onClick={() => answer(status)} data-testid={`signout-rsvp-${status}-btn`}
      className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-md border-2 px-3 text-sm font-bold ${cls}`}>
      {busy === status ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {children}
    </button>
  );
  return (
    <AlertDialog open={!!ask} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="signout-rsvp-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl font-extrabold">Can you make it?</AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm text-[var(--navy)]" data-testid="signout-rsvp-note">{ask?.name && <b className="block text-base">{ask.name}</b>}We&apos;ll inform the Skipper.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-2">
          <Btn status="out" icon={X} cls="border-[var(--navy)] bg-white text-[var(--navy)]">No</Btn>
          <Btn status="in" icon={Check} cls="border-emerald-700 bg-emerald-700 text-white">Yes</Btn>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!busy} className="btn-ghost mt-0 h-10 w-full justify-center text-sm" data-testid="signout-rsvp-back-btn">Back, stay signed in</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
