import { useEffect, useState } from "react";
import { Footprints } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { CrewWalkthrough, walkSteps } from "@/components/boat/CrewWalkthrough";
import { holdPrompt, usePromptsFree } from "@/lib/promptQueue";

const LATER_KEY = "mbp_walkthrough_later";
const later = () => { try { return JSON.parse(sessionStorage.getItem(LATER_KEY)) || []; } catch { return []; } };

// Crew on a shared boat with a Crew walkthrough they haven't signed off yet are asked once per log on.
export const WalkthroughPrompt = ({ boat, vessel, areas, online, onSignOff, onOpenArea }) => {
  const free = usePromptsFree(["invite", "agreement", "register"]);
  const [ask, setAsk] = useState(false);
  const [walking, setWalking] = useState(false);
  const key = `${boat.owner_id}_${boat.boat_id}`;
  const steps = walkSteps((boat.zone_maps || []).map((m) => ({ key: m.id, src: boatMapUrl(boat, m), map: m })));
  const has = steps.length > 0;
  useEffect(() => {
    if (!boat.owner_id || !online || !has || later().includes(key)) return;
    api.get("/crew-register/walkthrough", { params: { owner_id: boat.owner_id, boat_id: boat.boat_id }, timeout: 10000 })
      .then(({ data }) => setAsk(!data.done)).catch(() => {});
  }, [key, online, has]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { holdPrompt("walkthrough", ask || walking); return () => holdPrompt("walkthrough", false); }, [ask, walking]);
  const notNow = () => { sessionStorage.setItem(LATER_KEY, JSON.stringify([...later(), key])); setAsk(false); };

  if (walking) return <CrewWalkthrough steps={steps} areas={areas} onClose={() => setWalking(false)} onOpenArea={onOpenArea} onSignOff={onSignOff} />;
  if (!ask || !free) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && notNow()}>
      <DialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="walkthrough-prompt-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><Footprints className="h-5 w-5" /> Crew walkthrough</DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="walkthrough-prompt-text">
            Would you like to do the Crew walkthrough of {vessel}? It shows you {steps.length} {steps.length === 1 ? "stop" : "stops"} around the boat and what's stowed where. Sign off at the end and the skipper sees it's done.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={() => { setAsk(false); setWalking(true); }} data-testid="walkthrough-prompt-start-btn">
            <Footprints className="h-4 w-4" /> Start the walkthrough
          </button>
          <button type="button" className="btn-ghost h-11 justify-center" onClick={notNow} data-testid="walkthrough-prompt-later-btn">Not now</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
