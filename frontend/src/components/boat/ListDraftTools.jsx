import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { api, apiError } from "@/lib/api";

export const toLines = (text) => [...new Map(text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => [l.toLowerCase(), l])).values()];

export const AiDraftButton = ({ name, online = true, hasText, onDraft, testId = "create-list" }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [name]);
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
      <button type="button" onClick={draft} disabled={busy || !online} className="btn-ghost justify-center gap-2" data-testid={`${testId}-ai-draft-btn`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? "Writing your list..." : hasText ? "Replace with AI draft" : "Write this list with AI"}
      </button>
      {!online && <p className="text-xs text-[var(--muted)]" data-testid={`${testId}-ai-offline`}>AI drafts need a signal.</p>}
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
