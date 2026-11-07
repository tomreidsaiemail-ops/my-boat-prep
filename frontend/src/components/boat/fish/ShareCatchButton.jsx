import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Share2 } from "lucide-react";
import { catchCard, shareText } from "@/lib/catchCard";

// Shares the catch card through the phone's share sheet; on a computer it downloads the card instead.
export const ShareCatchButton = ({ c, size }) => {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      const blob = await catchCard(c, size);
      const name = `${c.report.species.common_name.replace(/[^\w]+/g, "-").toLowerCase()}-catch.jpg`;
      const file = new File([blob], name, { type: "image/jpeg" });
      const text = shareText(c, size);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `My catch: ${c.report.species.common_name}`, text });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        await navigator.clipboard?.writeText(text).catch(() => {});
        toast.success("Catch card downloaded, and the caption copied, ready to post");
      }
    } catch (e) {
      if (e?.name !== "AbortError") toast.error("Couldn't make your catch card, please try again");
    } finally { setBusy(false); }
  };
  return (
    <button type="button" className="btn-solid h-11 justify-center gap-2" onClick={share} disabled={busy} data-testid="fish-share-btn">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share my catch
    </button>
  );
};
