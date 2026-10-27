import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { api, apiError } from "@/lib/api";

export const toLines = (text) => [...new Map(text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => [l.toLowerCase(), l])).values()];
export const DESCRIPTION_MAX = 512;

export const ListDescriptionField = ({ value, onChange, testId = "create-list" }) => (
  <label className="flex flex-col gap-1 text-sm font-bold">List description
    <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, DESCRIPTION_MAX))} maxLength={DESCRIPTION_MAX} rows={3}
      placeholder="Describe what this list is for, e.g. Checks before a night passage, grouped by area of the boat"
      className="field-input min-h-[80px] py-2 font-normal leading-relaxed" data-testid={`${testId}-description-input`} />
    <span className="self-end text-xs font-normal text-[var(--muted)]" data-testid={`${testId}-description-count`}>{value.length}/{DESCRIPTION_MAX}</span>
  </label>
);

export const AiDraftButton = ({ name, description, online = true, hasText, onDraft, testId = "create-list" }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [description]);
  const draft = async () => {
    if (!description.trim()) { setNote("Describe the list in List Description first, then Magic List Generation can create the items"); return; }
    setBusy(true);
    setNote("");
    try {
      const { data } = await api.post("/ai/list-draft", { name: name.trim(), description: description.trim() }, { timeout: 90000 });
      onDraft(data.lines.join("\n"));
      setNote(`Items ready, edit them before you confirm. ${data.drafts_left} Magic List Generations left today.`);
    } catch (e) { setNote(apiError(e, "Magic List Generation couldn't create that list right now. Please try again.")); }
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={draft} disabled={busy || !online} className="btn-ghost justify-center gap-2 text-center" data-testid={`${testId}-ai-draft-btn`}>
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Sparkles className="h-4 w-4 shrink-0" />}
        {busy ? "Magic List Generation is working..." : hasText ? "Replace items using Magic List Generation" : "Create items using Magic List Generation"}
      </button>
      {!online && <p className="text-xs text-[var(--muted)]" data-testid={`${testId}-ai-offline`}>Magic List Generation needs a signal.</p>}
      {note && <p className="text-xs font-semibold" data-testid={`${testId}-ai-note`}>{note}</p>}
    </div>
  );
};

export const AutoIndentToggle = ({ checked, onChange, testId = "create-list" }) => (
  <label className="flex items-start gap-2 text-sm font-semibold">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${testId}-auto-indent-checkbox`} />
    Make numbered lines into group headings and indent the items below them
  </label>
);
