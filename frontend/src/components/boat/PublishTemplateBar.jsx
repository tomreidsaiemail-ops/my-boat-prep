import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmt = (iso) => new Date(iso).toLocaleDateString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric" });

export const PublishTemplateBar = ({ list, items, template, online, onPublish }) => {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      await onPublish(list.id, items.map((i) => ({ id: i.id, label: i.label, ...(i.dynamic ? { dynamic: i.dynamic } : {}) })));
      toast.success(`${list.name} published as the master template`);
    } catch (e) {
      toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Couldn't publish, please try again");
    } finally { setBusy(false); }
  };
  const open = () => {
    if (!online) { toast.error("Go online to publish the master template"); return; }
    if (!items.length) { toast.error("Add at least one item before publishing"); return; }
    setConfirm(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-[var(--navy)] bg-white p-3.5" data-testid="publish-template-bar">
      <p className="text-sm leading-relaxed" data-testid="publish-template-status">
        <b>Admin · Master template.</b>{" "}
        {template ? `Last published ${fmt(template.updated_at)} with ${template.items.length} items.` : "Not published yet: skippers get the built-in items."}
        {" "}New skippers start with it; existing skippers see an Updated note with "Get latest items", or get it when they reset {list.name}.
      </p>
      <button type="button" className="btn-solid flex h-12 items-center justify-center gap-2" disabled={busy} onClick={open} data-testid="publish-template-btn">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />} Publish as master template
      </button>
      <AlertDialog open={confirm} onOpenChange={(o) => !o && setConfirm(false)}>
        <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="publish-template-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold">Publish {list.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-[var(--navy)]">
              Your {items.length} {list.name} items (unticked) become the master template. New skippers start with them, and existing skippers get them next time they reset {list.name}. Cloned lists are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="publish-template-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction className="btn-solid px-5" onClick={publish} data-testid="publish-template-confirm-btn">Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
