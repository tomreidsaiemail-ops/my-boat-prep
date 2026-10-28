import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const APP_URL = "https://myboatprep.com";

const share = async () => {
  if (navigator.share) {
    try { await navigator.share({ title: "My Boat Prep", text: "Boat checklists, Ship's Log and Mayday scripts for skippers. Works offline at sea.", url: APP_URL }); }
    catch (e) { if (e.name !== "AbortError") toast.error("Couldn't open sharing on this phone"); }
    return;
  }
  try { await navigator.clipboard.writeText(APP_URL); toast.success("Link copied, paste it anywhere to share"); }
  catch { toast.error("Couldn't share on this device"); }
};

const PRINT_PX = 2048;

export const ShareAppDialog = ({ open, onClose }) => {
  const printRef = useRef(null);
  const download = () => {
    const svg = printRef.current?.querySelector("svg");
    if (!svg) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = PRINT_PX;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PRINT_PX, PRINT_PX);
      ctx.drawImage(img, 0, 0, PRINT_PX, PRINT_PX);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "myboatprep-qr-code.png";
      a.click();
      toast.success("QR code saved. It's 2048 pixels, sharp enough for flyers and stickers.");
    };
    img.onerror = () => toast.error("Couldn't make the QR picture on this device");
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="share-app-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Share the app</DialogTitle>
          <DialogDescription>Crew and friends scan this with their phone camera to open My Boat Prep.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-lg border-2 border-[var(--navy)] bg-white p-4" data-testid="share-app-qr">
            <QRCodeSVG value={APP_URL} size={220} level="M" marginSize={1} fgColor="#0f172a" bgColor="#ffffff" title="QR code for myboatprep.com" />
          </div>
          <div ref={printRef} className="hidden" data-testid="share-app-qr-print">
            <QRCodeSVG value={APP_URL} size={PRINT_PX} level="H" marginSize={4} fgColor="#000000" bgColor="#ffffff" />
          </div>
          <p className="font-mono text-base font-bold" data-testid="share-app-url">myboatprep.com</p>
          <button type="button" className="btn-solid h-12 w-full justify-center gap-2" onClick={share} data-testid="share-app-btn">
            <Share2 className="h-4 w-4" /> Share link
          </button>
          <button type="button" className="btn-ghost h-12 w-full justify-center gap-2" onClick={download} data-testid="share-app-download-btn">
            <Download className="h-4 w-4" /> Download QR for printing
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
