import { ANOTHER_LINES, SCAN_LINES, WalkButton, WalkList, WalkSection } from "@/components/boat/zone/BatchWalk";

// The Galley scan's yellow walkthrough: the first cupboard step by step, then how to carry on (stage: scan -> another -> done).
// marks: name = cupboard picked or typed (tick 1), where = location typed (tick 2), photo = photo chosen (tick 4); both make step 5 bold.
export const BatchAreaWalk = ({ stage, shown, marks, onToggle, onDone, onReview }) => (
  <div className="flex flex-col gap-2" data-testid="batch-area-walk">
    <WalkSection title="Batch Magic Scanning Instructions" open={shown.scan} onToggle={() => onToggle("scan")} testId="batch-area-walk-scan">
      <WalkList lines={SCAN_LINES} numbered testId="batch-area-walk-scan-list"
        ticks={[marks.name && 0, marks.where && 1, marks.photo && 3].filter((i) => i !== false)} bold={marks.where && marks.photo ? [4] : []} />
    </WalkSection>
    {stage !== "scan" && (
      <WalkSection title="Adding another cupboard" open={shown.another} onToggle={() => onToggle("another")} testId="batch-area-walk-another">
        <WalkList lines={ANOTHER_LINES} />
        {stage === "another" && <WalkButton onClick={onDone} testId="batch-area-walk-done">OK.  I got all that, I know how to batch magic scan!</WalkButton>}
        {stage === "another" && <WalkButton onClick={onReview} testId="batch-area-walk-review-help">I'll just need some help reviewing the batch that was scanned...</WalkButton>}
      </WalkSection>
    )}
    {stage === "review" && (
      <p className="rounded-lg border-2 border-amber-400 bg-yellow-100 px-3 py-2.5 text-left text-sm font-black text-[var(--navy)]" data-testid="batch-area-walk-review-note">Click Review Batch</p>
    )}
  </div>
);
