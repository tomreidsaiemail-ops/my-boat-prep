import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const TextDialog = ({ open, title, description, initial = "", placeholder, confirmLabel = "Confirm", onConfirm, onClose, testId, inputType, children }) => {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setValue(initial); setError(""); } }, [open, initial]);

  const submit = async (e) => {
    e.preventDefault();
    const res = await onConfirm(value.trim());
    if (typeof res === "string") setError(res);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid={`${testId}-dialog`} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {inputType ? (
            <input autoFocus aria-label={title} type={inputType} inputMode={inputType} autoComplete={inputType} value={value} placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)} className="field-input" data-testid={`${testId}-input`} />
          ) : (
          <textarea autoFocus aria-label={title} rows={value.length > 60 ? 4 : 2} value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
            className="field-input min-h-[56px] resize-none py-3" data-testid={`${testId}-input`} />
          )}
          {children}
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid={`${testId}-error`}>{error}</div>}
          <DialogFooter className="flex-row justify-end gap-2">
            <button type="button" className="btn-ghost px-5" onClick={onClose} data-testid={`${testId}-cancel-btn`}>Cancel</button>
            <button type="submit" className="btn-solid px-6" data-testid={`${testId}-confirm-btn`}>{confirmLabel}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
