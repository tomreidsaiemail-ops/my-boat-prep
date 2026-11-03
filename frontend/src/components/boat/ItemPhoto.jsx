import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Expand, Loader2, X } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

export const ITEM_PHOTO_LISTS = ["riggingChecks", "electricalService", "engineService"];

// One fetch per photo per session; rows re-render often.
const cache = new Map();
const load = (url) => {
  if (!cache.has(url)) cache.set(url, api.get(url, { responseType: "blob" }).then(({ data }) => URL.createObjectURL(data)).catch((e) => { cache.delete(url); throw e; }));
  return cache.get(url);
};

const usePhoto = (url) => {
  const [src, setSrc] = useState("");
  useEffect(() => { let live = true; load(url).then((s) => live && setSrc(s)).catch(() => live && setSrc("x")); return () => { live = false; }; }, [url]);
  return src;
};

const Thumb = ({ url, name, id }) => {
  const src = usePhoto(url);
  const [full, setFull] = useState(false);
  if (src === "x") return <span className="text-[10px] font-bold text-[var(--muted)]" data-testid={`item-photo-error-${id}`}>No photo</span>;
  return (
    <>
      <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button type="button" onClick={() => setFull(true)} aria-label={`Open the photo of ${name}`} data-testid={`item-photo-thumb-${id}`}
            className="h-8 w-8 shrink-0 overflow-hidden rounded border-[1.5px] border-[var(--line)] bg-[var(--panel)]">
            {src && <img src={src} alt="" className="h-full w-full object-cover" />}
          </button>
        </HoverCardTrigger>
        <HoverCardContent side="left" className="w-auto p-2" data-testid={`item-photo-preview-${id}`}>
          {src && <img src={src} alt={`Photo of ${name}`} className="h-44 w-44 rounded object-cover" />}
          <button type="button" className="btn-ghost mt-2 h-8 min-h-0 w-full justify-center gap-1.5 text-xs" onClick={() => setFull(true)} data-testid={`item-photo-open-${id}`}>
            <Expand className="h-3.5 w-3.5" /> Open full view
          </button>
        </HoverCardContent>
      </HoverCard>
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-3xl p-3" data-testid={`item-photo-full-${id}`}>
          <DialogTitle className="pr-8 text-sm">{name}</DialogTitle>
          {src && <img src={src} alt={`Photo of ${name}`} className="max-h-[78vh] w-full rounded object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
};

// Camera icon, or the photo's thumbnail with a red X; crew only see the thumbnail.
export const ItemPhoto = ({ item, name, photos }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const { boatId, owner, listId, canEdit, online, onAdd, onRemove } = photos;
  const url = `/boats/${boatId}/item-photo/${item.photo_id}${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`;
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!online) { toast.error("Adding a photo needs a signal"); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", await shrink(file, 1600), "item.jpg");
      const { data } = await api.post(`/boats/${boatId}/item-photo`, form, { params: { list_id: listId }, timeout: 60000 });
      onAdd(item.id, data.photo_id);
    } catch (err) { toast.error(apiError(err, "Couldn't add the photo, please try again")); }
    setBusy(false);
  };
  if (item.photo_id) {
    return (
      <span className="flex shrink-0 items-center gap-0.5" data-testid={`item-photo-${item.id}`}>
        <Thumb url={url} name={name} id={item.id} />
        {canEdit && <button type="button" className="flex h-8 w-7 items-center justify-center text-[var(--red)] hover:opacity-70" onClick={() => onRemove(item.id, item.photo_id)}
          aria-label="Delete photo" data-testid={`item-photo-delete-${item.id}`}><X className="h-4 w-4" strokeWidth={3} /></button>}
      </span>
    );
  }
  if (!canEdit) return null;
  return (
    <>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid={`item-photo-input-${item.id}`} />
      <button type="button" className="icon-btn !w-9" onClick={() => input.current?.click()} disabled={busy} aria-label="Add a photo" title="Add or take a photo" data-testid={`item-photo-add-${item.id}`}>
        {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Camera className="h-[18px] w-[18px]" />}
      </button>
    </>
  );
};
