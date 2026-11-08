import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Clicks on a toast (e.g. its action button) must not close the dialog underneath.
const keepForToast = (handler) => (e) => {
  if (e.target?.closest?.("[data-sonner-toaster]")) e.preventDefault();
  handler?.(e);
};

// Unsaved-changes guard: what's typed or picked in the window is compared with how it looked before the first tap or key press.
const skipField = (el) => el.type === "file" || el.type === "search" || el.readOnly || el.closest("[data-no-dirty]");
const snapshot = (root) => [
  ...[...root.querySelectorAll("input, textarea, select")].filter((el) => !skipField(el))
    .map((el) => (el.type === "checkbox" || el.type === "radio" ? String(el.checked) : el.value)),
  ...[...root.querySelectorAll("[role=checkbox][data-state], [role=switch][data-state], [role=radio][data-state], [role=combobox]")].filter((el) => !el.closest("[data-no-dirty]"))
    .map((el) => el.getAttribute("data-state") + (el.getAttribute("role") === "combobox" ? el.textContent : "")),
].join("\u0001");
const isCancel = (btn) => /^(cancel|close)$/i.test((btn.textContent || "").trim()) || /cancel-btn$/.test(btn.dataset.testid || "");

const DiscardPrompt = ({ run, onKeep }) => (
  <AlertDialog open={!!run} onOpenChange={(o) => !o && onKeep()}>
    <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="discard-changes-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display text-xl font-extrabold">Discard your changes?</AlertDialogTitle>
        <AlertDialogDescription data-testid="discard-changes-note">What you added, changed or deleted in this window hasn't been saved. Closing it now throws that away.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row justify-end gap-2">
        <AlertDialogCancel className="btn-ghost mt-0 px-4" data-testid="discard-changes-keep-btn">Keep editing</AlertDialogCancel>
        <AlertDialogAction className="btn-solid !bg-[var(--red)] px-4" onClick={() => setTimeout(run, 0)} data-testid="discard-changes-confirm-btn">Discard changes</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const DialogContent = React.forwardRef(({ className, children, onPointerDownOutside, onInteractOutside, onEscapeKeyDown, guard = true, dirty, ...props }, ref) => {
  const [ask, setAsk] = React.useState(null);
  const s = React.useRef({}).current;
  s.guard = guard; s.dirty = dirty; s.ask = ask; s.ref = ref;
  const isDirty = () => s.guard && !s.pass && !!s.box && (!!s.dirty || (s.base != null && snapshot(s.box) !== s.base));
  const again = (fn) => () => { s.pass = true; try { fn(); } finally { s.pass = false; } };
  const closeNow = again(() => s.close?.click());
  const setBox = React.useCallback((el) => {
    if (typeof s.ref === "function") s.ref(el); else if (s.ref) s.ref.current = el;
    if (!el || el === s.box) return;
    s.off?.(); s.box = el; s.base = null;
    const start = () => { if (s.base == null) s.base = snapshot(el); };
    const click = (e) => {
      const btn = e.target.closest?.("button");
      if (!btn || btn === s.close || !el.contains(btn) || !isCancel(btn) || !isDirty()) return;
      e.preventDefault(); e.stopPropagation();
      setAsk(() => again(() => btn.click()));
    };
    el.addEventListener("pointerdown", start, true); el.addEventListener("keydown", start, true); el.addEventListener("click", click, true);
    s.off = () => { el.removeEventListener("pointerdown", start, true); el.removeEventListener("keydown", start, true); el.removeEventListener("click", click, true); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hold = (handler) => (e) => {
    handler?.(e);
    if (e.defaultPrevented) return;
    if (s.ask) { e.preventDefault(); return; }
    if (isDirty()) { e.preventDefault(); setAsk(() => closeNow); }
  };
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setBox}
        onPointerDownOutside={keepForToast(hold(onPointerDownOutside))}
        onInteractOutside={keepForToast(hold(onInteractOutside))}
        onEscapeKeyDown={hold(onEscapeKeyDown)}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...props}>
        {children}
        <DialogPrimitive.Close ref={(el) => { s.close = el; }} onClick={hold()}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
        <DiscardPrompt run={ask} onKeep={() => setAsk(null)} />
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
