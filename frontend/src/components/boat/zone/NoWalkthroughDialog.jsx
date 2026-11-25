import { useState } from "react";
import { ChevronDown, Footprints } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LinkedText } from "@/components/boat/LinkedText";

// "I would like to create a Crew walkthrough" with nothing to walk through yet: what a walkthrough needs and, if the boat has a Galley zone, a way straight to it.
export const NoWalkthroughDialog = ({ open, galley, help, onGalley, onClose }) => {
  const [more, setMore] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="no-walkthrough-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><Footprints className="h-5 w-5" /> Creating Crew Walkthroughs</DialogTitle>
          <DialogDescription className="text-left text-sm font-bold text-[var(--navy)]" data-testid="no-walkthrough-message">There&apos;s nothing to walk your crew through yet: no photos of zones or cupboards.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-800">
          <p data-testid="no-walkthrough-galley-tip">A crew walkthrough needs you to, say, take a photo of the Galley and then label where the pantry is.</p>
          <p data-testid="no-walkthrough-locker-tip">Alternatively you can take a photo of your technical locker, and include it in the walkthrough for a more technically minded crew member.</p>
          {help?.length > 0 && (
            <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-1 self-start font-bold text-[var(--blue)]" data-testid="no-walkthrough-more-btn">
              More help <ChevronDown className={`h-4 w-4 [transition:transform_.15s] ${more ? "rotate-180" : ""}`} />
            </button>
          )}
          {more && help.map((i, k) => (
            <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : ""} data-testid={`no-walkthrough-help-${k}`}><LinkedText text={i.label} testId={`no-walkthrough-help-link-${k}`} /></p>
          ))}
          {galley && <p className="mt-1 font-bold text-[var(--navy)]" data-testid="no-walkthrough-galley-question">Would you like to open the {galley.label} zone to add a photo?</p>}
        </div>
        <div className="flex flex-col gap-2">
          {galley && <button type="button" className="btn-solid min-h-11 justify-center" onClick={onGalley} data-testid="no-walkthrough-galley-btn">OK, I&apos;ll add a {galley.label} photo now</button>}
          <button type="button" className={`${galley ? "btn-ghost" : "btn-solid"} min-h-11 justify-center`} onClick={onClose} data-testid="no-walkthrough-later-btn">Thanks, I&apos;ll add some photos later</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
