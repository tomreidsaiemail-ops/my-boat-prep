import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { isHeadingLine, linesToItems } from "@/lib/outline";
import { AiDraftButton, AutoIndentToggle, ListDescriptionField, toLines } from "@/components/boat/ListDraftTools";

const errText = (e) => (typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Couldn't save, please check your signal");
const LINE_MAX = 4000;
// Grows with the text so the end of a long help paragraph is never hidden.
const fit = (el) => { if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight + 4, window.innerHeight * 0.7)}px`; } };

export const TemplateListEditor = ({ initial, onSave, onCancel }) => {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [text, setText] = useState(initial ? initial.items.map((i) => i.label).join("\n") : "");
  const [autoIndent, setAutoIndent] = useState(!initial || initial.items.some((i) => i.indent || isHeadingLine(i.label)));
  const [priv, setPriv] = useState(!!initial?.private);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lines = toLines(text);
  const headings = lines.filter(isHeadingLine).length;
  const area = useRef(null);
  useEffect(() => fit(area.current), [text]);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter a list name"); return; }
    if (!lines.length) { setError("Add at least one item"); return; }
    const long = lines.findIndex((l) => l.length > LINE_MAX);
    if (long >= 0) { setError(`Line ${long + 1} has ${lines[long].length} characters. Please keep each line under ${LINE_MAX}, or split it into two lines.`); return; }
    setBusy(true);
    setError("");
    const items = linesToItems(lines, autoIndent, 0, LINE_MAX).map((i) => ({ label: i.label, indent: !!i.indent }));
    try { await onSave({ name: name.trim(), description: description.trim(), items, private: priv, note: note.trim() }); } catch (err) { setError(errText(err)); setBusy(false); }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-lg border-2 border-[var(--navy)] bg-white p-4" data-testid="template-list-editor">
      <label className="flex flex-col gap-1 text-sm font-bold">List name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Prep your trip" className="field-input" data-testid="template-list-name-input" />
      </label>
      <ListDescriptionField value={description} onChange={setDescription} testId="template-list" />
      <AiDraftButton name={name} description={description} hasText={!!lines.length} onDraft={setText} testId="template-list" />
      <label className="flex flex-col gap-1 text-sm font-bold">Items, one per line
        <textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"1. Before leaving (dock)\nCheck the marine forecast\nFuel and water topped up"}
          className="field-input min-h-[180px] py-2 font-normal leading-relaxed" data-testid="template-list-items-input" />
      </label>
      <p className="text-xs text-[var(--muted)]" data-testid="template-list-item-count">{lines.length} {lines.length === 1 ? "item" : "items"}{headings ? `, ${headings} ${headings === 1 ? "heading" : "headings"}` : ""}</p>
      <AutoIndentToggle checked={autoIndent} onChange={setAutoIndent} headings={headings} hasLines={!!lines.length} testId="template-list" />
      {initial && !priv && (
        <label className="flex flex-col gap-1 text-sm font-bold">Why this changed (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Added a VHF radio check" className="field-input font-normal" data-testid="template-list-note-input" />
          <span className="text-xs font-normal text-[var(--muted)]">Skippers see this in the Merge Latest summary if the items changed.</span>
        </label>
      )}
      <label className="flex items-start gap-2 text-sm font-bold">
        <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--navy)]" data-testid="template-list-private-checkbox" />
        <span>Private to admin user<span className="block text-xs font-normal text-[var(--muted)]">Kept in the Admin panel only, never sent to any boat. Use for system lists like Admin - Food Synonyms and Admin - Food Noise Words.</span></span>
      </label>
      {error && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid="template-list-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-5" onClick={onCancel} disabled={busy} data-testid="template-list-cancel-btn">Cancel</button>
        <button type="submit" className="btn-solid px-5" disabled={busy} data-testid="template-list-save-btn">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save changes" : priv ? "Save Admin Use Only" : "Publish to every boat"}
        </button>
      </div>
    </form>
  );
};
