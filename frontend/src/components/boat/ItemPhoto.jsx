import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, X } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TextDialog } from "@/components/boat/TextDialog";
import { Img, PhotoSlots, SLOTS, slotsOf } from "@/components/boat/PhotoSlots";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

export const ITEM_PHOTO_LISTS = ["riggingChecks", "electricalService", "engineService"];

// Compact row control: a camera icon, or a thumbnail (split in two when there is a before and an after photo).
export const ItemPhoto = ({ item, name, photos }) => {
  const input = useRef(null);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [noteFor, setNoteFor] = useState(null);
  const { boatId, owner, listId, canEdit, online, onPatch } = photos;
  const urlFor = (pid) => `/boats/${boatId}/item-photo/${pid}${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`;
  const have = slotsOf(item);
  const pick = (s) => { setSlot(s); input.current?.click(); };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !slot) return;
    if (!online) { toast.error("Adding a photo needs a signal"); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", await shrink(file, 1600), "item.jpg");
      const { data } = await api.post(`/boats/${boatId}/item-photo`, form, { params: { list_id: listId }, timeout: 60000 });
      onPatch(item.id, { [slot.id]: data.photo_id });
      toast.success(`${slot.label} photo added`);
    } catch (err) { toast.error(apiError(err, "Couldn't add the photo, please try again")); }
    setBusy(false);
  };
  const remove = (s) => {
    const pid = item[s.id];
    onPatch(item.id, { [s.id]: undefined, [s.note]: undefined });
    api.delete(`/boats/${boatId}/item-photo/${pid}`).catch(() => {});
    toast.success(`${s.label} photo deleted`);
  };
  if (!have.length && !canEdit) return null;
  const slotProps = { item, name, urlFor, canEdit, id: item.id, onPick: pick, onRemove: remove, onNote: setNoteFor, onFull: () => setFull(true) };
  return (
    <>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} data-testid={`item-photo-input-${item.id}`} />
      {!have.length ? (
        <button type="button" className="icon-btn !w-9" onClick={() => pick(SLOTS[0])} disabled={busy} aria-label="Add a photo" title="Add or take a photo" data-testid={`item-photo-add-${item.id}`}>
          {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Camera className="h-[18px] w-[18px]" />}
        </button>
      ) : (
        <span className="relative mr-1 flex w-9 shrink-0 items-center" data-testid={`item-photo-${item.id}`}>
          <HoverCard openDelay={150} closeDelay={150}>
            <HoverCardTrigger asChild>
              <button type="button" onClick={() => setFull(true)} aria-label={`Open the photos of ${name}`} data-testid={`item-photo-thumb-${item.id}`}
                className="flex h-8 w-8 shrink-0 overflow-hidden rounded border-[1.5px] border-[var(--line)] bg-[var(--panel)]">
                {have.map((s) => <Img key={s.key} url={urlFor(item[s.id])} alt="" className={`h-full ${have.length === 2 ? "w-1/2" : "w-full"}`} />)}
              </button>
            </HoverCardTrigger>
            <HoverCardContent side="left" className="w-auto p-2" data-testid={`item-photo-preview-${item.id}`}>
              <PhotoSlots {...slotProps} />
            </HoverCardContent>
          </HoverCard>
          {busy && <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-white" />}
          {canEdit && have.length === 1 && <button type="button" onClick={() => remove(have[0])} aria-label="Delete photo" data-testid={`item-photo-delete-${item.id}`}
            className="absolute -right-1 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--red)] text-white shadow ring-2 ring-white hover:opacity-80"><X className="h-3 w-3" strokeWidth={3.5} /></button>}
          {have.length === 2 && <span className="absolute -right-1 -top-2 rounded-full bg-[var(--navy)] px-1 text-[9px] font-extrabold leading-4 text-white ring-2 ring-white" data-testid={`item-photo-count-${item.id}`}>2</span>}
        </span>
      )}
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto p-3" data-testid={`item-photo-full-${item.id}`}>
          <DialogTitle className="pr-8 text-sm">{name}</DialogTitle>
          <PhotoSlots {...slotProps} big />
        </DialogContent>
      </Dialog>
      <TextDialog open={!!noteFor} title={`${noteFor?.label || ""} photo caption`} description="A short note, like 'replaced May 2026'. Leave it empty to remove it."
        placeholder="e.g. replaced May 2026" confirmLabel="Save caption" testId="item-photo-caption" maxLength={80} initial={noteFor ? item[noteFor.note] || "" : ""}
        onConfirm={(v) => { onPatch(item.id, { [noteFor.note]: v.trim() || undefined }); setNoteFor(null); return true; }} onClose={() => setNoteFor(null)} />
    </>
  );
};
