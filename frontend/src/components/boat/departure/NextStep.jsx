// The trip's next step: a yellow link to the list that comes next ("Next step - Arriving at Destination, Mooring").
export const NextStep = ({ label, onClick, testId, prefix = "Please click" }) => (
  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-bold text-[var(--navy)]" data-testid={testId}>
    {prefix}
    <button type="button" onClick={onClick} className="rounded-md border-[1.5px] border-yellow-500 bg-yellow-300 px-2.5 py-1.5 text-left font-extrabold underline underline-offset-2 hover:bg-yellow-400 active:scale-95 [transition:background-color_.15s,transform_.1s]"
      data-testid={`${testId}-link`}>{label}</button>
  </p>
);

// What the plan says comes next (the planned arrival, how you'll leave, New departure...), shown yellow on its button.
export const PLANNED = "!border-2 !border-yellow-500 !bg-yellow-300 !text-[var(--navy)] hover:!bg-yellow-400";
