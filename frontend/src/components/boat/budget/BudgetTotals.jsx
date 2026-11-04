import { money, sumYear } from "@/lib/budget";

const Total = ({ label, value, tone, testId }) => (
  <div className={`flex items-center justify-between gap-2 rounded-md border-[1.5px] px-3 py-2 ${tone || "border-[var(--line)] bg-white"}`} data-testid={testId}>
    <span className="text-sm font-bold">{label}</span>
    <span className="font-mono text-sm font-bold" data-testid={`${testId}-value`}>{value}</span>
  </div>
);

export const BudgetTotals = ({ items, currency, total }) => {
  const y = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-1.5" data-testid="budget-year-totals">
      <Total label="Total cost (all years)" value={total} tone="border-[var(--navy)] bg-white" testId="budget-total-all-card" />
      <Total label={`Total cost this year so far (${y})`} value={money(sumYear(items, y), currency)} testId="budget-total-this-year" />
      <Total label={`Total cost last year (${y - 1})`} value={money(sumYear(items, y - 1), currency)} tone="border-orange-300 bg-orange-50" testId="budget-total-last-year" />
      <Total label={`Total cost previous year (${y - 2})`} value={money(sumYear(items, y - 2), currency)} tone="border-red-300 bg-red-50" testId="budget-total-previous-year" />
      <p className="text-xs text-[var(--muted)]" data-testid="budget-colour-key">
        Year totals add up each year's budget rows. Rows paid last year ({y - 1}) are orange. Rows paid in {y - 2} or earlier are red.
      </p>
    </div>
  );
};
