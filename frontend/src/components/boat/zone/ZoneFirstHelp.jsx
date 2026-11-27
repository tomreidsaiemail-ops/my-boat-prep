import { useRef, useState } from "react";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHold } from "@/lib/tripGuide";
import { GUIDE_BOX as BOX } from "@/lib/findGuide";

export const SAMPLE_CUTLERY = "/samples/cutlery-drawer.jpg";

// The Cutlery Drawer's first Magic Scan: the sample image, or a photo of their own.
const SampleScan = ({ onSample, onOwn, onClose, t }) => {
  const own = useRef(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-md flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" data-testid={`${t}-sample-dialog`}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Magic Scan the Cutlery Drawer</DialogTitle>
          <DialogDescription className={`${BOX} text-left`} data-testid={`${t}-sample-help`}>
            The sample image is displayed. The system will guide you through the steps for the items it scans - for example finding a fork from the sample image, or that bottle opener. Click &quot;Use the sample image&quot;.
          </DialogDescription>
        </DialogHeader>
        <img src={SAMPLE_CUTLERY} alt="Sample cutlery drawer with knives, forks, spoons and a bottle opener" className="max-h-[45vh] w-full rounded-md object-contain" data-testid={`${t}-sample-image`} />
        <button type="button" className="btn-solid mbp-glow min-h-12 justify-center gap-2" onClick={onSample} data-testid={`${t}-sample-use-btn`}><Sparkles className="h-5 w-5" /> Use the sample image</button>
        <button type="button" className="btn-ghost min-h-12 justify-center gap-2" onClick={() => own.current?.click()} data-testid={`${t}-sample-own-btn`}><Camera className="h-5 w-5" /> Photo and upload my own</button>
        <input ref={own} type="file" accept="image/*" className="hidden" onChange={onOwn} aria-label="Photo of your cutlery drawer" data-testid={`${t}-sample-own-input`} />
      </DialogContent>
    </Dialog>
  );
};

// The first zone window anyone opens. Galley: help Magic Scanning its Cutlery Drawer; other zones: open a cupboard, or create one.
export const ZoneFirstHelp = ({ help, count, t, scanning, onSample, onOwn }) => {
  const [ask, setAsk] = useState(false);
  const galley = help.kind === "galley";
  useHold(`${t}-quick`, !galley && !count);
  // The Cutlery Drawer (opened below): its photo icon and both Magic Scan buttons stay yellow too, once they show.
  const id = galley ? help.id : "";
  useHold(`inventory-area-photo-${id}`, galley);
  useHold(`inventory-scan-btn-${id}`, galley);
  useHold(`inventory-scan-photos-btn-${id}`, galley);
  if (!galley) {
    return (
      <p className={BOX} data-testid={`${t}-first-help-text`}>
        {count ? `${count === 1 ? "Open the cupboard below" : `Open one of the ${count} cupboards below`}, you will see "Upload image for Magic Scan", so you can upload an image and have it scanned.`
          : "Create a cupboard, you will then see it under this Zone and will be able to expand it and magic scan an uploaded photo."}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid={`${t}-first-help`}>
      <p className={BOX} data-testid={`${t}-first-help-text`}>{help.made ? "We've added a Cutlery Drawer to your Galley. " : ""}Would you like some help Magic Scanning the Cutlery Drawer?</p>
      <button type="button" disabled={scanning} onClick={() => setAsk(true)} data-testid={`${t}-first-help-yes-btn`}
        className="btn-solid min-h-11 self-start gap-2 !border-2 !border-yellow-500 !bg-yellow-300 px-5 !text-[var(--navy)] hover:!bg-yellow-400">
        {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning the Cutlery Drawer...</> : <>Yes, please show me. I&apos;d also like to know more about &quot;Find&quot;...</>}
      </button>
      {ask && <SampleScan t={t} onClose={() => setAsk(false)} onSample={() => { setAsk(false); onSample(); }} onOwn={(e) => { onOwn(e); setAsk(false); }} />}
    </div>
  );
};
