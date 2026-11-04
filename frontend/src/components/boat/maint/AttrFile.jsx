import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Img } from "@/components/boat/PhotoSlots";
import { shrink } from "@/components/boat/PhotoPicker";
import { api, apiError } from "@/lib/api";

// Photo or PDF attribute: upload, open and delete. Files live in object storage; the item keeps only the id.
export const AttrFile = ({ def, attrs, onChange, ctx, testId }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const pdf = def.type === "pdf";
  const id = attrs[def.key];
  const base = `/boats/${ctx.boatId}/${pdf ? "item-file" : "item-photo"}`;
  const url = (fid) => `${base}/${fid}${ctx.owner ? `?owner=${encodeURIComponent(ctx.owner)}` : ""}`;
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ctx.online) { toast.error("Uploading needs a signal"); return; }
    setBusy(true);
    try {
      const form = new FormData();
      if (pdf) form.append("file", file, file.name);
      else form.append("file", await shrink(file, 1600), "item.jpg");
      const { data } = await api.post(base, form, { params: { list_id: ctx.listId }, timeout: 90000 });
      if (id) api.delete(`${base}/${id}`).catch(() => {});
      onChange(pdf ? { [def.key]: data.file_id, [`${def.key}__name`]: data.name } : { [def.key]: data.photo_id });
      toast.success(`${def.name} added`);
    } catch (err) { toast.error(apiError(err, `Couldn't add the ${pdf ? "PDF" : "photo"}, please try again`)); }
    setBusy(false);
  };
  const remove = () => {
    onChange({ [def.key]: "", [`${def.key}__name`]: undefined });
    api.delete(`${base}/${id}`).catch(() => {});
    toast.success(`${def.name} deleted`);
  };
  const openPdf = async () => {
    const win = window.open("", "_blank");
    try {
      const { data } = await api.get(url(id), { responseType: "blob", timeout: 60000 });
      const href = URL.createObjectURL(data);
      if (win) win.location.href = href; else window.location.href = href;
    } catch (err) { win?.close(); toast.error(apiError(err, "Couldn't open the PDF")); }
  };
  const Icon = pdf ? FileText : Camera;
  return (
    <div className="flex min-h-10 items-center gap-2" data-testid={testId}>
      <input ref={input} type="file" accept={pdf ? "application/pdf" : "image/*"} className="hidden" onChange={upload} data-testid={`${testId}-input`} />
      {id && (pdf
        ? <button type="button" onClick={openPdf} className="btn-ghost h-10 min-h-0 min-w-0 gap-1.5 px-2 text-xs" data-testid={`${testId}-open`}>
            <FileText className="h-4 w-4 shrink-0" /><span className="truncate">{attrs[`${def.key}__name`] || "Open PDF"}</span>
          </button>
        : <button type="button" onClick={() => setFull(true)} aria-label={`Open ${def.name}`} className="h-12 w-12 shrink-0 overflow-hidden rounded border-[1.5px] border-[var(--line)]" data-testid={`${testId}-thumb`}>
            <Img url={url(id)} alt={def.name} className="h-full w-full" />
          </button>)}
      {!ctx.readOnly && (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn-ghost h-10 min-h-0 gap-1.5 px-2 text-xs" data-testid={`${testId}-upload`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : id ? <Upload className="h-4 w-4" /> : <Icon className="h-4 w-4" />} {id ? "Replace" : pdf ? "Upload PDF" : "Add photo"}
        </button>
      )}
      {id && !ctx.readOnly && (
        <button type="button" onClick={remove} aria-label={`Delete ${def.name}`} className="icon-btn !h-10 !w-10 text-[var(--red)]" data-testid={`${testId}-delete`}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {!id && ctx.readOnly && <span className="text-xs text-[var(--muted)]">None</span>}
      {!pdf && id && (
        <Dialog open={full} onOpenChange={setFull}>
          <DialogContent className="max-w-lg p-3" data-testid={`${testId}-full`}>
            <DialogTitle className="text-base font-bold">{def.name}</DialogTitle>
            <Img url={url(id)} alt={def.name} className="max-h-[70vh] w-full rounded object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
