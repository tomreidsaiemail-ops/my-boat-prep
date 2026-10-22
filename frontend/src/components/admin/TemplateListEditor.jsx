import { useState } from "react";
import { Loader2 } from "lucide-react";

const errText = (e) => (typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Couldn't save, please check your signal");

export const TemplateListEditor = ({ initial, onSave, onCancel }) => {
  const [name, setName] = useState(initial?.name || "");
  const [text, setText] = useState(initial ? initial.items.map((i) => i.label).join("\n") : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lines = [...new Map(text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => [l.toLowerCase(), l])).values()];

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter a list name"); return; }
    if (!lines.length) { setError("Add at least one item"); return; }
    setBusy(true);
    setError("");
    try { await onSave({ name: name.trim(), items: lines }); } catch (err) { setError(errText(err)); setBusy(false); }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-lg border-2 border-[var(--navy)] bg-white p-4" data-testid="template-list-editor">
      <label className="flex flex-col gap-1 text-sm font-bold">List name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Prep your trip" className="field-input" data-testid="template-list-name-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold">Items, one per line
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"Check the marine forecast\nFuel and water topped up\nLodge trip report"}
          className="field-input min-h-[180px] py-2 font-normal leading-relaxed" data-testid="template-list-items-input" />
      </label>
      <p className="text-xs text-[var(--muted)]" data-testid="template-list-item-count">{lines.length} {lines.length === 1 ? "item" : "items"}</p>
      {error && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid="template-list-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-5" onClick={onCancel} disabled={busy} data-testid="template-list-cancel-btn">Cancel</button>
        <button type="submit" className="btn-solid px-5" disabled={busy} data-testid="template-list-save-btn">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save changes" : "Publish to every boat"}
        </button>
      </div>
    </form>
  );
};
