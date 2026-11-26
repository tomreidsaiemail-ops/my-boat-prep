import { Check, ChevronDown, TriangleAlert } from "lucide-react";

export const isGalley = (z) => String(z?.label || "").trim().toLowerCase() === "galley";

const SEEN = "mbp_batch_walk_seen";
// The first Batch Magic Scan walks the skipper through; after that it's a tick box, off unless they ask.
export const firstBatchWalk = () => {
  const first = localStorage.getItem(SEEN) !== "1";
  localStorage.setItem(SEEN, "1");
  return first;
};

export const HOW_LINES = [
  "When starting out do one zone at a time",
  "The galley will be used for the walkthrough",
  "Scanning by zone is the function that is part of the new user walkthrough",
  "Scanning the whole boat is best explored later",
];
export const PLAN_LINES = [
  "Have an idea what cupboards are in your zone, the galley say",
  "Take as many cupboard contents photos before you get started",
  "Be familiar with scanning boxes and folders and putting them in cupboards (you can easily add them to a well named cupboard)",
  "Separately photo boxes or folders, laying out the contents\n(you can return the items to their box or folder after photographing them)",
  "If cupboard items are obscured, take them out so they are in the photo",
  "Pick Galley below and we can get started",
];
export const SCAN_LINES = [
  "Select a drawer, e.g. the Cutlery Drawer",
  "Say where it is in the Galley, use the Fridge and Oven as reference points, eye height or waist height also good reference points",
  "See below \"Take or choose a photo\"",
  "Now upload the Cutlery Drawer photo",
  "Press the Confirm, and add another button",
];
export const ANOTHER_LINES = [
  "Select another cupboard, say the Pantry this time, if you know it's empty choose another",
  "Again you are going to say where it is relative to something",
  "Again you are going to upload its photo",
  "Again you are going to click Confirm, and add another",
  "You are going to repeat this for each cupboard, and then the Galley is fully scanned.",
  "Take a moment to put that box you scanned into the appropriate cupboard, the Pantry say",
  <>Repeat this for all cupboards in each zone, and then <b className="font-black">Review Batch</b></>,
];

// A yellow walkthrough section that folds away.
export const WalkSection = ({ title, open, onToggle, testId, children }) => (
  <section className="rounded-lg border-2 border-amber-400 bg-yellow-100 text-left text-sm text-[var(--navy)]" data-testid={testId}>
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-3 text-left font-extrabold" data-testid={`${testId}-toggle`}>
      <span className="flex-1">{title}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="flex flex-col gap-2.5 px-3 pb-3" data-testid={`${testId}-body`}>{children}</div>}
  </section>
);

// ticks: line indexes done (green tick); bold: line indexes to stress.
export const WalkList = ({ lines, numbered = false, ticks = [], bold = [], testId }) => {
  const Tag = numbered ? "ol" : "ul";
  return (
    <Tag className={`flex flex-col gap-1.5 pl-5 font-semibold ${numbered ? "list-decimal" : "list-disc"}`}>
      {lines.map((l, i) => (
        <li key={i} className={`whitespace-pre-line ${bold.includes(i) ? "font-black" : ""}`} data-testid={testId && `${testId}-line-${i + 1}`}>
          {ticks.includes(i) && <Check className="mr-1 inline h-4 w-4 rounded-full bg-emerald-600 p-0.5 align-[-2px] text-white" strokeWidth={4} aria-label="Done" data-testid={testId && `${testId}-tick-${i + 1}`} />}
          {l}
        </li>
      ))}
    </Tag>
  );
};

export const WalkButton = ({ onClick, testId, children = "Continue..." }) => (
  <button type="button" onClick={onClick} className="btn-ghost mbp-glow h-11 justify-center text-sm font-extrabold" data-testid={testId}>{children}</button>
);

// After the first time: the walkthrough only shows when the skipper ticks this.
export const WalkOptIn = ({ on, onChange }) => (
  <div className="flex flex-col gap-2" data-testid="batch-walk-optin">
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold text-[var(--navy)]">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="batch-walk-optin-checkbox" />
      Walk me through batch magic scan
    </label>
    {on && (
      <p role="alert" className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900" data-testid="batch-walk-warning">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> This walkthrough may refer to Cupboards where scanning is complete. So use as a guide only
      </p>
    )}
  </div>
);
