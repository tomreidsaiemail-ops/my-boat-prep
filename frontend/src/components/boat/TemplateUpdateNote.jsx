import { Sparkles } from "lucide-react";

export const TemplateUpdateNote = ({ listName, onMerge, onKeepMine }) => (
  <div className="flex flex-col gap-3 rounded-lg border-2 border-[var(--blue)] bg-sky-50 p-3.5 text-sky-950" data-testid="template-update-note">
    <p className="flex items-start gap-2 text-sm leading-relaxed">
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--blue)] px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white" data-testid="template-updated-badge">
        <Sparkles className="h-3 w-3" /> Updated
      </span>
      <span data-testid="template-update-text">New Master items are available for merge with <b>{listName}</b>. Your <b>{listName}</b> will be kept by default.</span>
    </p>
    <div className="flex gap-2">
      <button type="button" className="btn-solid h-11 flex-1" onClick={onMerge} data-testid="template-merge-latest-btn">Merge Latest</button>
      <button type="button" className="btn-ghost h-11 px-4" onClick={onKeepMine} data-testid="template-keep-mine-btn">Keep mine</button>
    </div>
  </div>
);
