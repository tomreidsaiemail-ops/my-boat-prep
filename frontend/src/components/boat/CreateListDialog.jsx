import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { isHeadingLine } from "@/lib/outline";
import { AiDraftButton, AutoIndentToggle, DESCRIPTION_MAX, ListDescriptionField, toLines } from "@/components/boat/ListDraftTools";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import useAdminLists, { stripPrefix } from "@/hooks/useAdminLists";

const HELP_SEEN = "mbp_newlist_help_seen";
const TEMPLATE_PREFIX = "Admin - List Template - ";
const templateText = (t) => t.items.map((i) => `${i.indent ? "  " : ""}${i.label}`).join("\n").slice(0, DESCRIPTION_MAX);

// Admin "Admin - List Template - ..." lists; picking one fills List description with its items.
const TemplatePicker = ({ templates, value, onPick }) => (
  <label className="flex flex-col gap-1 text-sm font-bold">List templates
    <select value={value} onChange={(e) => onPick(templates.find((t) => t.name === e.target.value))} disabled={!templates.length}
      className="field-input font-normal disabled:opacity-60" data-testid="create-list-template-select">
      <option value="" disabled>{templates.length ? "Choose a template (optional)" : "No templates yet"}</option>
      {templates.map((t) => <option key={t.name} value={t.name} data-testid={`create-list-template-option-${stripPrefix(t.name, TEMPLATE_PREFIX)}`}>{stripPrefix(t.name, TEMPLATE_PREFIX)}</option>)}
    </select>
  </label>
);

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

export const CreateListDialog = ({ open, online, onConfirm, onClose }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("");
  const templates = useAdminLists(TEMPLATE_PREFIX, online && open);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [askEmpty, setAskEmpty] = useState(false);
  const [help, setHelp] = useState(false);
  const [autoIndent, setAutoIndent] = useState(true);
  const lines = toLines(text);
  const headings = lines.filter(isHeadingLine).length;

  useEffect(() => {
    if (!open) return;
    setName(""); setDescription(""); setTemplate(""); setText(""); setError(""); setAskEmpty(false); setAutoIndent(true);
    setHelp(localStorage.getItem(HELP_SEEN) !== "1");
    localStorage.setItem(HELP_SEEN, "1");
  }, [open]);

  // Only ask before replacing a description the user typed or changed themselves.
  const pickTemplate = (t) => {
    const prev = templates.find((x) => x.name === template);
    const own = description.trim() && description !== (prev ? templateText(prev) : "");
    if (own && !window.confirm(`Replace your List description with the ${stripPrefix(t.name, TEMPLATE_PREFIX)} template?`)) return;
    setTemplate(t.name);
    setDescription(templateText(t));
  };
  const create = () => {
    const res = onConfirm(name.trim(), lines, autoIndent, description.trim());
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
          <TemplatePicker templates={templates} value={template} onPick={pickTemplate} />
          <ListDescriptionField value={description} onChange={setDescription} />
          <ItemsHelp open={help} onToggle={() => setHelp((h) => !h)} />
          <AiDraftButton name={name} description={description} online={online} hasText={!!lines.length} onDraft={(t) => { setText(t); setAskEmpty(false); }} />
          <label className="flex flex-col gap-1 text-sm font-bold">Items, one per line
            <textarea value={text} onChange={(e) => { setText(e.target.value); setAskEmpty(false); }} rows={7} placeholder={"1. Before leaving (dock)\nCheck the marine forecast\nFuel and water topped up"}
              className="field-input min-h-[150px] py-2 font-normal leading-relaxed" data-testid="create-list-items-input" />
          </label>
          <p className="text-xs text-[var(--muted)]" data-testid="create-list-item-count">{lines.length} {lines.length === 1 ? "item" : "items"}{headings ? `, ${headings} ${headings === 1 ? "heading" : "headings"}` : ""}</p>
          <AutoIndentToggle checked={autoIndent} onChange={setAutoIndent} />
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
