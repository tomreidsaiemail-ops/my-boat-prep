import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/api";

const STEPS = {
  buyer: ["Sign in to My Boat Prep with your own account.", "Open the menu ☰ at the top and choose Request Ownership Transfer...",
    "Enter the boat's name exactly as the seller has it (capitals and spaces don't matter) and the seller's email (the one they sign in with).",
    "Tap Request transfer. You can do this at any time, even before the seller starts; the request is held until they're ready."],
  start: ["Open the boat, then the menu ☰ and choose Transfer ownership...", "Tick each statement to confirm what the new owner will and won't receive, then tap Start."],
  wizard: ["The wizard goes through every cupboard, box and folder that still has items in it. Food & Drink cupboards are skipped (they're emptied on sale).",
    "Tap Add or remove items to update each one in the normal cupboard window. Use Next and Back to move between them.",
    "The last page shows the whole inventory with every zone and cupboard opened out. Check it, then tap Finish. A Transfer ownership list is created (crew can't see it)."],
  list: ["Tap Email Transfer Ownership Checklist; it's sent to your own email. When it arrives, tick Transfer Ownership checklist received.",
    "Tap Export All to save all your lists, then tick Export and save all lists for your records.", "Work through the checklist with your broker and buyer."],
  sell: ["SELL MY BOAT stays disabled until the buyer has sent their request. If more than one person has asked, pick the new owner.",
    "Both ticks are needed, otherwise the button shows an error. Tap Transfer ownership - SELL MY BOAT and confirm twice; a sale can't be undone.",
    "You'll see Transfer successful. The boat leaves your account completely. Anyone else who asked is told by email and their request is removed."],
  after: ["The buyer gets a Handover Pack email (a short summary first, then every zone, cupboard and item, and the maintenance history) and a message in the app.",
    "The boat appears in the buyer's account with the same name. The Ship's Log ends with \"Boat sold to new owner\" and the date."],
};
const KEPT = ["The boat's name, details and photo", "Zones, zone maps and zone photos", "All non-food cupboards, boxes and folders with their contents",
  "Item photos and attached files", "Maintenance lists and logs", "The Ship's Log in full, with every crew member's name and email replaced by XXXXXXXXXX",
  "Trip Planning as a blank list (unticked, no route)"];
const GONE = ["Crew registrations and all crew access", "Crew Prep lists made for individual crew members", "Previous trips, archived route plans and the current Trip Planning details",
  "Shore contacts and their alerts", "The watch rota and crew invites", "All items in Food & Drink cupboards (even non-food items)", "The Transfer ownership checklist"];

const Steps = ({ title, rows, start = 1, testId }) => (
  <section className="break-inside-avoid" data-testid={testId}>
    <h3 className="mt-4 font-display text-base font-extrabold">{title}</h3>
    <ol start={start} className="ml-5 list-decimal space-y-1 text-sm">{rows.map((r) => <li key={r}>{r}</li>)}</ol>
  </section>
);

const Part = ({ title, children }) => <><h2 className="mt-6 border-b-2 border-[var(--navy)] pb-1 font-display text-lg font-extrabold">{title}</h2>{children}</>;

// Printable step-by-step guide to share with brokers and clients (signed-in only).
export default function TransferGuide() {
  const nav = useNavigate();
  const [checklist, setChecklist] = useState([]);
  useEffect(() => { api.get("/ownership/checklist").then(({ data }) => setChecklist(data.items)).catch(() => setChecklist([])); }, []);
  return (
    <main className="mx-auto max-w-2xl bg-white px-5 py-6 text-[var(--navy)] print:max-w-none print:p-0" data-testid="transfer-guide-page">
      <div className="mb-4 flex gap-2 print:hidden">
        <button type="button" className="btn-ghost h-11 px-4" onClick={() => nav(-1)} data-testid="transfer-guide-back-btn"><ArrowLeft className="h-4 w-4" />Back</button>
        <button type="button" className="btn-solid h-11 px-4" onClick={() => window.print()} data-testid="transfer-guide-print-btn"><Printer className="h-4 w-4" />Print / Save as PDF</button>
      </div>
      <h1 className="font-display text-3xl font-extrabold">My Boat Prep: Transferring Boat Ownership</h1>
      <p className="mt-2 text-sm">A step-by-step guide for sellers, buyers and brokers. The seller and the buyer each need their own My Boat Prep account; only the boat's owner (the skipper) can transfer it.</p>
      <Part title="Part A: Buyer requests the transfer"><Steps title="Request Ownership Transfer" rows={STEPS.buyer} testId="guide-buyer" /></Part>
      <Part title="Part B: Seller prepares and sells the boat">
        <Steps title="Step 1: Start the transfer" rows={STEPS.start} testId="guide-start" />
        <Steps title="Step 2: Review the cupboards" rows={STEPS.wizard} start={3} testId="guide-wizard" />
        <Steps title="Step 3: Complete the Transfer ownership list" rows={STEPS.list} start={6} testId="guide-list" />
        <Steps title="Step 4: Sell" rows={STEPS.sell} start={9} testId="guide-sell" />
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]">The Transfer ownership checklist is deleted at the moment of transfer. The new owner will not see it.</p>
      </Part>
      <Part title="Part C: Buyer after the sale"><Steps title="Handover" rows={STEPS.after} testId="guide-after" /></Part>
      <Part title="Part D: What carries over and what is removed">
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <Steps title="Carried over to the new owner" rows={KEPT} testId="guide-kept" />
          <Steps title="Removed" rows={GONE} testId="guide-removed" />
        </div>
        <p className="mt-2 text-sm">The seller loses the boat from their account completely; exporting all lists first is their record.</p>
      </Part>
      <Part title="Part E: Transfer Ownership Checklist (seller)"><Steps title="Checklist" rows={checklist} testId="guide-checklist" /></Part>
    </main>
  );
}
