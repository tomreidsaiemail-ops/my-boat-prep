import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle, Loader2, Sparkles } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { isHeadingLine } from "@/lib/outline";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const HELP_SEEN = "mbp_newlist_help_seen";
const toLines = (text) => [...new Map(text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => [l.toLowerCase(), l])).values()];

const ItemsHelp = ({ open, onToggle }) => (
  <div className="rounded-md border border-[var(--navy)]/30 bg-sky-50" data-testid="create-list-help">
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold" data-testid="create-list-help-toggle">
      <HelpCircle className="h-4 w-4 shrink-0" /> How to add items
      <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && (
      <div className="space-y-2 px-3 pb-3 text-sm leading-relaxed" data-testid="create-list-help-body">
        <p>Paste a list from your own notes or from the internet, just make sure each list item gets its own line. You can tidy it up once the list is created.</p>
        <p data-testid="create-list-skipper-tip"><span className="font-bold">Skipper's tip:</span> you can add a category in one line and then items for that category then add another category in a new line and then more items, each in their own new line. You can then use the "Indent" feature in the app to collapse your items into the categories you created, much like is done with the First Aid lists. Don't be afraid to add some explanation, in brackets, to your categories - this may really help new crew members. It may also help to number the categories initially to differentiate them from items.</p>
      </div>
    )}
  </div>
);

const AiDraftButton = ({ name, online, hasText, onDraft }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const draft = async () => {
    if (!name.trim()) { setNote("Enter a list name first, then the AI can write it"); return; }
    setBusy(true);
    setNote("");
    try {
      const { data } = await api.post("/ai/list-draft", { name: name.trim() }, { timeout: 90000 });
      onDraft(data.lines.join("\n"));
      setNote(`Draft ready, edit it before you confirm. ${data.drafts_left} AI drafts left today.`);
    } catch (e) { setNote(apiError(e, "The AI couldn't write that list right now. Please try again.")); }
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={draft} disabled={busy || !online} className="btn-ghost justify-center gap-2" data-testid="create-list-ai-draft-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? "Writing your list..." : hasText ? "Replace with AI draft" : "Write this list with AI"}
      </button>
      {!online && <p className="text-xs text-[var(--muted)]" data-testid="create-list-ai-offline">AI drafts need a signal.</p>}
      {note && <p className="text-xs font-semibold" data-testid="create-list-ai-note">{note}</p>}
    </div>
  );
};

export const CreateListDialog = ({ open, online, onConfirm, onClose }) => {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [askEmpty, setAskEmpty] = useState(false);
  const [help, setHelp] = useState(false);
  const [autoIndent, setAutoIndent] = useState(true);
  const lines = toLines(text);
  const headings = lines.filter(isHeadingLine).length;

  useEffect(() => {
    if (!open) return;
    setName(""); setText(""); setError(""); setAskEmpty(false); setAutoIndent(true);
    setHelp(localStorage.getItem(HELP_SEEN) !== "1");
    localStorage.setItem(HELP_SEEN, "1");
  }, [open]);

  const create = () => {
    const res = onConfirm(name.trim(), lines, autoIndent);
    if (typeof res === "string") { setError(res); setAskEmpty(false); }
  };
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter a list name"); return; }
    if (!lines.length) { setError(""); setAskEmpty(true); return; }
    create();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="create-list-dialog" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Create New List</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input autoFocus aria-label="List name" value={name} maxLength={60} placeholder="Enter new list name (e.g., Engine)" onChange={(e) => setName(e.target.value)}
            className="field-input" data-testid="create-list-input" />
          <ItemsHelp open={help} onToggle={() => setHelp((h) => !h)} />
          <AiDraftButton name={name} online={online} hasText={!!lines.length} onDraft={(t) => { setText(t); setAskEmpty(false); }} />
          <label className="flex flex-col gap-1 text-sm font-bold">Items, one per line
            <textarea value={text} onChange={(e) => { setText(e.target.value); setAskEmpty(false); }} rows={7} placeholder={"1. Before leaving (dock)\nCheck the marine forecast\nFuel and water topped up"}
              className="field-input min-h-[150px] py-2 font-normal leading-relaxed" data-testid="create-list-items-input" />
          </label>
          <p className="text-xs text-[var(--muted)]" data-testid="create-list-item-count">{lines.length} {lines.length === 1 ? "item" : "items"}{headings ? `, ${headings} ${headings === 1 ? "heading" : "headings"}` : ""}</p>
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input type="checkbox" checked={autoIndent} onChange={(e) => setAutoIndent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="create-list-auto-indent-checkbox" />
            Make numbered lines into group headings and indent the items below them
          </label>
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="create-list-error">{error}</div>}
          {askEmpty ? (
            <div role="alertdialog" className="flex flex-col gap-3 rounded-md border-2 border-amber-400 bg-amber-50 p-3" data-testid="create-list-empty-warning">
              <p className="text-sm font-bold">Create an empty list?</p>
              <p className="text-sm">You haven't added any items. You can add them later.</p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost px-4" onClick={() => setAskEmpty(false)} data-testid="create-list-go-back-btn">Go back</button>
                <button type="button" className="btn-solid px-4" onClick={create} data-testid="create-list-create-anyway-btn">Create anyway</button>
              </div>
            </div>
          ) : (
            <DialogFooter className="flex-row justify-end gap-2">
              <button type="button" className="btn-ghost px-5" onClick={onClose} data-testid="create-list-cancel-btn">Cancel</button>
              <button type="submit" className="btn-solid px-6" data-testid="create-list-confirm-btn">Confirm</button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
