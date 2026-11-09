import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";

const EMAIL = /[^\s,;<>()"']+@[^\s,;<>()"']+\.[A-Za-z]{2,}/;

// One person per line: "Tom Smith, tom@email.com", "Tom Smith <tom@email.com>", tab-separated from a spreadsheet, or just an email.
export const parsePeople = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
  const email = (line.match(EMAIL) || [""])[0];
  const name = line.replace(email, "").replace(/[<>()"\t,;]+/g, " ").replace(/\s+/g, " ").trim() || email.split("@")[0];
  return { name: name.slice(0, 60), email };
});

export const BulkQuickReg = ({ open, onDone, onClose }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const people = parsePeople(text);
  const ready = people.filter((p) => p.email);
  const close = () => { setText(""); setResult(null); onClose(); };
  const save = async () => {
    if (!ready.length) { toast.error("Paste at least one name and email"); return; }
    if (ready.length > 50) { toast.error("Up to 50 people at a time"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/crew-register/quick-bulk", { people: ready });
      const noEmail = people.filter((p) => !p.email).map((p) => ({ name: p.name || "A line", reason: "No email found" }));
      setResult({ ...data, skipped: [...noEmail, ...data.skipped] });
      if (data.added.length) { toast.success(`${data.added.length} crew registered with Quick Reg`); onDone(); }
      if (!data.skipped.length && !noEmail.length) close();
    } catch (e) { toast.error(apiError(e, "Couldn't add them, please try again")); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="bulk-quick-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><Zap className="h-5 w-5 fill-amber-400 text-amber-600" /> Bulk Quick Reg</DialogTitle>
          <DialogDescription className="text-left text-sm">Paste one person per line, name then email, e.g. <b>Tom Smith, tom@email.com</b>. They&apos;re all registered straight away, and you can ask each one to add their own details later.</DialogDescription>
        </DialogHeader>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={7} className="field-input min-h-[150px] py-2 font-mono text-sm"
          placeholder={"Tom Smith, tom@email.com\nDick Jones, dick@email.com\nHarry Brown, harry@email.com"} data-testid="bulk-quick-text" />
        {people.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs" data-testid="bulk-quick-preview">
            {people.slice(0, 50).map((p, i) => (
              <li key={i} className={`flex justify-between gap-2 rounded px-2 py-1 ${p.email ? "bg-slate-50" : "bg-red-50 text-red-800"}`}>
                <span className="truncate font-bold">{p.name || "No name"}</span><span className="truncate">{p.email || "No email found"}</span>
              </li>
            ))}
          </ul>
        )}
        {result?.skipped.length > 0 && (
          <div className="rounded-md border-2 border-amber-500 bg-amber-50 p-2 text-xs" data-testid="bulk-quick-skipped">
            <p className="font-extrabold">Not added ({result.skipped.length}):</p>
            {result.skipped.map((s, i) => <p key={i}><b>{s.name}</b>: {s.reason}</p>)}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={close} data-testid="bulk-quick-cancel-btn">{result ? "Done" : "Cancel"}</button>
          <button type="button" className="btn-solid h-12 flex-1 justify-center gap-2" disabled={busy || !ready.length || !!result} onClick={save} data-testid="bulk-quick-save-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Quick Reg {ready.length || ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
