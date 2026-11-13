import { useEffect, useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { Check, Crop, Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_SIDE = 1600;

// Holds the picture waiting in the crop step and what to do with the cropped result.
export const useCropStep = () => {
  const [crop, setCrop] = useState(null);
  const open = (blob, save) => setCrop({ src: URL.createObjectURL(blob), save });
  const close = () => setCrop((c) => { if (c) URL.revokeObjectURL(c.src); return null; });
  return { crop, open, close };
};

const toBlob = (canvas) => new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("crop failed"))), "image/jpeg", 0.9));

// Zoom (pinch/scroll), pan (drag the picture) and a free-shape crop box before a schematic is saved.
export const CropDialog = ({ src, busy, onSave, onCancel }) => {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(false), [src]);
  const cropper = () => ref.current?.cropper;
  const save = async (whole) => {
    const c = cropper();
    if (!c) return;
    // Reset brings back the starting crop box, which covers the whole picture (autoCropArea 1).
    if (whole) c.reset();
    onSave(await toBlob(c.getCroppedCanvas({ maxWidth: MAX_SIDE, maxHeight: MAX_SIDE, fillColor: "#fff", imageSmoothingQuality: "high" })));
  };
  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="max-h-[94vh] max-w-2xl gap-3 overflow-y-auto p-4" data-testid="crop-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left text-base"><Crop className="h-4 w-4" /> Zoom &amp; crop your schematic</DialogTitle>
          <DialogDescription className="text-left text-xs">Pinch or scroll to zoom, drag the picture to move it, and drag the box corners to keep just your layout.</DialogDescription>
        </DialogHeader>
        <div className="h-[55vh] min-h-[260px] overflow-hidden rounded-md border-2 border-[var(--line)] bg-slate-100" data-testid="crop-area">
          {src && (
            <Cropper key={src} ref={ref} src={src} style={{ height: "100%", width: "100%" }} viewMode={1} dragMode="move" autoCropArea={1}
              guides background={false} responsive checkOrientation={false} toggleDragModeOnDblclick={false} ready={() => setReady(true)} />
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="btn-ghost h-11 justify-center gap-1.5 text-sm" disabled={!ready || busy} onClick={() => cropper()?.zoom(0.2)} data-testid="crop-zoom-in-btn">
            <ZoomIn className="h-4 w-4" /> Zoom in
          </button>
          <button type="button" className="btn-ghost h-11 justify-center gap-1.5 text-sm" disabled={!ready || busy} onClick={() => cropper()?.zoom(-0.2)} data-testid="crop-zoom-out-btn">
            <ZoomOut className="h-4 w-4" /> Zoom out
          </button>
          <button type="button" className="btn-ghost h-11 justify-center gap-1.5 text-sm" disabled={!ready || busy} onClick={() => cropper()?.reset()} data-testid="crop-reset-btn">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
        <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!ready || busy} onClick={() => save(false)} data-testid="crop-save-btn">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Crop
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost h-11 justify-center text-sm" disabled={!ready || busy} onClick={() => save(true)} data-testid="crop-whole-btn">Use whole picture</button>
          <button type="button" className="btn-ghost h-11 justify-center text-sm" disabled={busy} onClick={onCancel} data-testid="crop-cancel-btn">Cancel</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
