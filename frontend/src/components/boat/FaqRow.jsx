import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";

const Badge = ({ letter, cls, testId }) => (
  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-display text-base font-extrabold ${cls}`} aria-hidden="true" data-testid={testId}>{letter}</span>
);

export const FaqRow = ({ item, admin, first, last, busy, onEdit, onDelete, onMove }) => (
  <li className="checklist-row flex-col" data-testid={`faq-item-${item.id}`}>
    <div className="flex w-full flex-col gap-3 px-3 py-4">
      <div className="flex items-start gap-3">
        <Badge letter="Q" cls="bg-[var(--navy)] text-white" testId={`faq-q-icon-${item.id}`} />
        <p className="item-text pt-1 font-bold" data-testid={`faq-question-${item.id}`}><span className="sr-only">Question: </span>{item.question}</p>
      </div>
      <div className="flex items-start gap-3">
        <Badge letter="A" cls="border-2 border-[var(--blue)] bg-sky-50 text-[var(--blue)]" testId={`faq-a-icon-${item.id}`} />
        <p className="item-text whitespace-pre-line pt-1" data-testid={`faq-answer-${item.id}`}><span className="sr-only">Answer: </span>{item.answer}</p>
      </div>
    </div>
    {admin && (
      <div className="-mt-2 flex items-center gap-1 pb-2 pl-12" data-testid={`faq-tools-${item.id}`}>
        <button type="button" className="prio-btn" disabled={first || busy} onClick={() => onMove(-1)} aria-label="Move up" data-testid={`faq-up-${item.id}`}><ArrowUp className="h-5 w-5" /></button>
        <button type="button" className="prio-btn" disabled={last || busy} onClick={() => onMove(1)} aria-label="Move down" data-testid={`faq-down-${item.id}`}><ArrowDown className="h-5 w-5" /></button>
        <button type="button" className="icon-btn" disabled={busy} onClick={onEdit} aria-label="Edit" data-testid={`faq-edit-${item.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
        <button type="button" className="icon-btn hover:text-[var(--red)]" disabled={busy} onClick={onDelete} aria-label="Delete" data-testid={`faq-delete-${item.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>
    )}
  </li>
);
