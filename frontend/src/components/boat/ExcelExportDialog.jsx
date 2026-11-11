import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FolderArchive, Loader2, Table2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportMaster, exportOne, exportZip, photoCollector, stamp } from "@/lib/excelExport";
import { api } from "@/lib/api";

const OPTIONS = [
  { id: "one", Icon: FileSpreadsheet, title: "This list", text: (n) => `"${n}" as one spreadsheet` },
  { id: "zip", Icon: FolderArchive, title: "Every list, separate spreadsheets", text: () => "One zip file with a spreadsheet for each list and your boat data" },
  { id: "master", Icon: Table2, title: "Every list, one master spreadsheet", text: () => `A tab for each list and your boat data, saved as Boat_Lists_Export_${stamp()}.xlsx` },
];

// buildSheets(all, photo) returns [{ name, rows }]: just the current list, or every list plus boat details, inventory, service history, zone maps and crew.
export const ExcelExportDialog = ({ open, onClose, listName, title, buildSheets, online = true }) => {
  const [busy, setBusy] = useState("");
  const [photos, setPhotos] = useState(false);
  const run = async (id) => {
    if (photos && !online) { toast.error("Exporting photos needs a signal. Untick Include photos to export offline."); return; }
    setBusy(id);
    try {
      const ph = photoCollector(photos);
      const sheets = await buildSheets(id !== "one", ph.add);
      const pics = photos ? await ph.fetchAll((url) => api.get(url, { responseType: "blob", timeout: 60000 }).then((r) => r.data)) : [];
      ph.fix(sheets);
      const date = stamp();
      const name = id === "one" ? await exportOne(sheets[0], date, pics) : id === "zip" ? await exportZip(sheets, title, date, pics) : await exportMaster(sheets, title, date, pics);
      toast.success(photos ? `Saved ${name} (${pics.length} ${pics.length === 1 ? "photo" : "photos"})` : `Saved ${name}`);
      onClose();
    } catch { toast.error("Couldn't make the spreadsheet, please try again"); }
    setBusy("");
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md" data-testid="excel-export-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><FileSpreadsheet className="h-5 w-5" /> Export to Excel</DialogTitle>
          <DialogDescription className="text-left text-sm">Your data, yours to keep. Each file name ends with today&apos;s date ({stamp()}) so you know when the snapshot was taken.</DialogDescription>
        </DialogHeader>
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border-[1.5px] border-[var(--line)] bg-slate-50 px-3 py-2 text-sm" data-testid="excel-export-photos">
          <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} disabled={!!busy} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="excel-export-photos-input" />
          <span><b>Include photos</b><span className="block text-xs text-[var(--muted)]">Cupboard, zone map and list item photos go in a Photos folder in a zip with the spreadsheet. Each row names its photo, and the name opens it. Needs a signal.</span></span>
        </label>
        <div className="flex flex-col gap-2">
          {OPTIONS.map(({ id, Icon, title: t, text }) => (
            <button key={id} type="button" disabled={!!busy} onClick={() => run(id)} data-testid={`excel-export-${id}-btn`}
              className="flex min-h-[60px] items-center gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white px-3 py-2 text-left [transition:border-color_.15s,background-color_.15s] hover:border-[var(--navy)] hover:bg-slate-50 disabled:opacity-60">
              {busy === id ? <Loader2 className="h-6 w-6 shrink-0 animate-spin" /> : <Icon className="h-6 w-6 shrink-0 text-[#1D6F42]" />}
              <span className="min-w-0">
                <span className="block text-sm font-extrabold">{t}</span>
                <span className="block text-xs text-[var(--muted)]">{text(listName)}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
