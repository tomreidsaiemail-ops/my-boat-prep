import { ANOTHER_LINES, SCAN_LINES, WalkButton, WalkList, WalkSection } from "@/components/boat/zone/BatchWalk";

// The Galley scan's yellow walkthrough: the first cupboard step by step, then how to carry on (stage: scan -> another -> done).
export const BatchAreaWalk = ({ stage, shown, onToggle, onDone }) => (
  <div className="flex flex-col gap-2" data-testid="batch-area-walk">
    <WalkSection title="Batch Magic Scanning Instructions" open={shown.scan} onToggle={() => onToggle("scan")} testId="batch-area-walk-scan">
      <WalkList lines={SCAN_LINES} numbered />
    </WalkSection>
    {stage !== "scan" && (
      <WalkSection title="Adding another cupboard" open={shown.another} onToggle={() => onToggle("another")} testId="batch-area-walk-another">
        <WalkList lines={ANOTHER_LINES} />
        {stage === "another" && <WalkButton onClick={onDone} testId="batch-area-walk-done">OK.  I got all that, I know how to batch magic scan!</WalkButton>}
      </WalkSection>
    )}
  </div>
);
