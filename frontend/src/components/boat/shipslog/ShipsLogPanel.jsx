import { useState } from "react";
import { toast } from "sonner";
import { ShipsLogTools } from "@/components/boat/shipslog/ShipsLogTools";
import { PassageGroupDialog } from "@/components/boat/shipslog/PassageGroupDialog";
import { FoldYearDialog } from "@/components/boat/shipslog/FoldYearDialog";
import { PaperLogScanDialog } from "@/components/boat/shipslog/PaperLogScanDialog";
import { foldYear, groupPassage } from "@/lib/logFolders";

// Skipper tools above the Ship's Log: passage folders, year folders and paper log scans.
export const ShipsLogPanel = ({ items, setItems, labelFor, boat, boatId, guard, help, online, needPro, folders }) => {
  const [open, setOpen] = useState(null);
  const undoable = (next, text) => {
    const before = items;
    setItems(() => next);
    toast.success(text, { duration: 6000, action: { label: "Undo", onClick: () => setItems(() => before) } });
    setOpen(null);
  };
  const group = (start, end, meta) => {
    const next = groupPassage(items, start, end, meta);
    if (!next) { toast.error("Choose a Start log and an End log from the Ship's Log."); return; }
    undoable(next, `Grouped into "${next.find((i) => i.folder && !items.some((x) => x.id === i.id)).label}"`);
  };
  const year = (y) => { const next = foldYear(items, y); if (next) undoable(next, `Folded into "${y} Ship's Logs"`); };
  const scan = () => {
    if (!guard() || !needPro("Batch Magic Scan Paper Logs")) return;
    if (!online) { toast.error("Batch Magic Scan Paper Logs needs a signal"); return; }
    setOpen("scan");
  };
  const addLogs = (rows) => {
    setItems((list) => [...list, ...rows]);
    toast.success(`${rows.length} paper ${rows.length === 1 ? "log" : "logs"} added to the Ship's Log`);
    setOpen(null);
  };
  return (
    <>
      <ShipsLogTools hasFolders={folders.hasFolders} anyOpen={folders.anyOpen} onAll={folders.setAll}
        onGroup={() => guard() && setOpen("group")} onYear={() => guard() && setOpen("year")} onScan={scan} />
      {open === "group" && <PassageGroupDialog items={items} labelFor={labelFor} boat={boat} help={help} onGroup={group} onClose={() => setOpen(null)} />}
      {open === "year" && <FoldYearDialog items={items} onFold={year} onClose={() => setOpen(null)} />}
      {open === "scan" && <PaperLogScanDialog boatId={boatId} onAdd={addLogs} onClose={() => setOpen(null)} />}
    </>
  );
};
