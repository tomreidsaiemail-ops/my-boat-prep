import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Martini, Share2, Sunset, X, Youtube } from "lucide-react";
import { sundownerPick } from "@/lib/bartender";
import { localDayKey, sundownerTime } from "@/lib/sun";

const DISMISS_KEY = "mbp_sundowner_dismissed";

const useMinute = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  return now;
};

const shareText = (vessel, c, kid) => [
  `Sundowner on ${vessel || "the boat"} tonight: ${c.label}!`, c.uses?.length ? `With ${c.uses.join(", ")}.` : "", `How to make it: ${c.youtube}`,
  kid ? `For the kids: ${kid.label} (alcohol-free) ${kid.youtube}` : "",
].filter(Boolean).join("\n");

const Pick = ({ c, tag }) => (
  <div className="flex items-center gap-3" data-testid={`sundowner-pick-${tag}`}>
    {c.photo ? <img src={c.photo} alt={c.label} className="h-14 w-14 shrink-0 rounded-md object-cover" />
      : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white/20"><Martini className="h-6 w-6" /></span>}
    <div className="min-w-0">
      <p className="font-display text-lg font-extrabold leading-tight" data-testid={`sundowner-name-${tag}`}>{c.label}</p>
      {tag === "kids" && <p className="text-xs font-bold text-amber-100">For the kids, alcohol-free</p>}
      <a href={c.youtube} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-red-700" data-testid={`sundowner-youtube-${tag}`}>
        <Youtube className="h-3.5 w-3.5" /> How to make it
      </a>
    </div>
  </div>
);

// From sunset where the boat is, a daily cocktail pick from the Magic Bartender list, ready to share with the crew.
export const SundownerCard = ({ items, vessel, gps, kids, onOpen }) => {
  const now = useMinute();
  const day = localDayKey(now);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY));
  const pick = sundownerPick(items, day);
  const kid = kids ? sundownerPick(items, day, true) : null;
  const at = sundownerTime(gps, now);
  if (!pick || dismissed === day || now < at) return null;
  const share = async () => {
    const text = shareText(vessel, pick, kid);
    if (navigator.share) { try { await navigator.share({ title: "Tonight's Sundowner", text }); } catch { /* closed */ } return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    toast.success("Opening WhatsApp to share tonight's Sundowner");
  };
  const dismiss = () => { localStorage.setItem(DISMISS_KEY, day); setDismissed(day); };
  return (
    <section className="relative flex flex-col gap-3 rounded-lg bg-gradient-to-br from-orange-500 via-rose-500 to-purple-700 p-4 text-white shadow-lg" data-testid="sundowner-card">
      <button type="button" onClick={dismiss} aria-label="Hide tonight's Sundowner" className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20" data-testid="sundowner-dismiss-btn"><X className="h-4 w-4" /></button>
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest" data-testid="sundowner-title">
        <Sunset className="h-4 w-4" /> Sundowner time · {at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </p>
      <Pick c={pick} tag="main" />
      {kid && <Pick c={kid} tag="kids" />}
      <div className="flex gap-2">
        <button type="button" onClick={share} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-white font-bold text-rose-700 [transition:transform_.1s] active:scale-95" data-testid="sundowner-share-btn"><Share2 className="h-4 w-4" /> Share with the crew</button>
        <button type="button" onClick={onOpen} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border-2 border-white/80 px-3 text-sm font-bold" data-testid="sundowner-open-btn"><Martini className="h-4 w-4" /> All cocktails</button>
      </div>
    </section>
  );
};
