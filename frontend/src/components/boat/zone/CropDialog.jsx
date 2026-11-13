import { useEffect, useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { Check, Crop, Loader2, RefreshCcw, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_SIDE = 1600;

// Holds the picture waiting in the crop step and what to do with the cropped result.
export const useCropStep = () => {
  const [crop, setCrop] = useState(null);
  const open = (blob, save) => setCrop({ src: URL.createObjectURL(blob), save });
  const close = () => setCrop((c) => { if (c) URL.revokeObjectURL(c.src); return null; });
  return { crop, open, close };
};

// Turns the picture a quarter turn (90 = clockwise) on a canvas, so the crop box refits the turned picture.
const turned = (url, deg) => new Promise((ok, bad) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const g = canvas.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.translate(canvas.width / 2, canvas.height / 2);
    g.rotate((deg * Math.PI) / 180);
    g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    canvas.toBlob((b) => (b ? ok(URL.createObjectURL(b)) : bad(new Error("rotate failed"))), "image/jpeg", 0.92);
  };
  img.onerror = bad;
  img.src = url;
});

const Tool = ({ icon: Icon, label, testId, ...rest }) => (
  <button type="button" className="btn-ghost h-14 flex-col justify-center gap-0.5 px-1 text-xs" data-testid={testId} {...rest}>
    <Icon className="h-4 w-4" /> {label}
  </button>
);

const toBlob = (canvas) => new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("crop failed"))), "image/jpeg", 0.9));

// Zoom (pinch/scroll), pan (drag the picture) and a free-shape crop box before a schematic is saved.
export const CropDialog = ({ src, busy, onSave, onCancel }) => {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState(src);
  useEffect(() => { setReady(false); setView(src); }, [src]);
  useEffect(() => () => { if (view && view !== src) URL.revokeObjectURL(view); }, [view, src]);
  const cropper = () => ref.current?.cropper;
  const rotate = async (deg) => {
    setReady(false);
    try { setView(await turned(view, deg)); } catch { setReady(true); }
  };
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
          <DialogDescription className="text-left text-xs">Turn the picture so the bow faces right, pinch or scroll to zoom, drag the picture to move it, and drag the box corners to keep just your layout.</DialogDescription>
        </DialogHeader>
        <div className="h-[55vh] min-h-[260px] overflow-hidden rounded-md border-2 border-[var(--line)] bg-slate-100" data-testid="crop-area">
          {view && (
            <Cropper key={view} ref={ref} src={view} style={{ height: "100%", width: "100%" }} viewMode={1} dragMode="move" autoCropArea={1}
              guides background={false} responsive checkOrientation={false} toggleDragModeOnDblclick={false} ready={() => setReady(true)} />
          )}
        </div>
        <div className="grid grid-cols-5 gap-1.5" data-testid="crop-tools">
          <Tool icon={RotateCcw} label="Rotate left" testId="crop-rotate-left-btn" disabled={!ready || busy} onClick={() => rotate(-90)} title="Turn 90° anti-clockwise" />
          <Tool icon={RotateCw} label="Rotate right" testId="crop-rotate-right-btn" disabled={!ready || busy} onClick={() => rotate(90)} title="Turn 90° clockwise" />
          <Tool icon={ZoomIn} label="Zoom in" testId="crop-zoom-in-btn" disabled={!ready || busy} onClick={() => cropper()?.zoom(0.2)} />
          <Tool icon={ZoomOut} label="Zoom out" testId="crop-zoom-out-btn" disabled={!ready || busy} onClick={() => cropper()?.zoom(-0.2)} />
          <Tool icon={RefreshCcw} label="Reset" testId="crop-reset-btn" disabled={!ready || busy} onClick={() => cropper()?.reset()} title="Back to the whole picture" />
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
