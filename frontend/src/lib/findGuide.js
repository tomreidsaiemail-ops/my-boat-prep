import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { areaPhotos } from "@/components/boat/inventory/CupboardPhoto";

// New skipper guide from the sample Cutlery Drawer Magic Scan to finding its Fork with Search, kept on this device per user.
// "review" (Magic Scan Discoveries), "save" (after Continue), "done" (zone window Done), "search" (magnifying glass and Search), "" not running.
const KEY = (uid) => `mbp_find_guide:${uid}`;
const EV = "mbp:find-guide";
export const GUIDE_BOX = "rounded-md bg-yellow-200 px-2.5 py-2 text-sm font-bold text-[var(--navy)]";

export const useFindGuide = () => {
  const { user } = useAuth();
  const key = KEY(user?.user_id || "");
  const [stage, setStage] = useState(() => localStorage.getItem(key) || "");
  useEffect(() => {
    const up = () => setStage(localStorage.getItem(key) || "");
    up();
    window.addEventListener(EV, up);
    return () => window.removeEventListener(EV, up);
  }, [key]);
  const to = (s) => { localStorage.setItem(key, s); window.dispatchEvent(new Event(EV)); };
  return [stage, to];
};

const WORDS = ["Fork", "Bottle opener"];
const hasWord = (w, name) => new RegExp(`\\b${w}s?\\b`, "i").test(name || "");
export const isFindWord = (name) => WORDS.some((w) => hasWord(w, name));
// The sample words in the inventory, but only while the sample is the boat's only photo.
export const findWords = (boat, areas) => {
  const photos = areas.reduce((n, a) => n + areaPhotos(a).length, 0) + (boat?.zone_maps || []).filter((m) => m.kind !== "overview").length;
  if (photos > 1) return [];
  return WORDS.filter((w) => areas.some((a) => (a.items || []).some((i) => !i.removed && hasWord(w, i.name))));
};
