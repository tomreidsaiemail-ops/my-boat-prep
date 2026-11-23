import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { spot } from "@/lib/tripGuide";

// Crew joined plus invites out; the crew window sends "mbp:crew-info" whenever it reloads.
const useCrewCount = (boatId, online) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (online && boatId) api.get(`/boats/${boatId}/crew`).then(({ data }) => setN((data.crew || []).length + (data.invites || []).length)).catch(() => {});
    const f = (e) => { if (e.detail?.boat_id === boatId) setN(e.detail.n); };
    window.addEventListener("mbp:crew-info", f);
    return () => window.removeEventListener("mbp:crew-info", f);
  }, [boatId, online]);
  return n;
};

const Todo = ({ n, label, done, extra, onClick, testId }) => (
  <li>
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-left text-sm font-bold text-[var(--navy)] underline underline-offset-2 hover:text-sky-800 active:scale-95 [transition:color_.15s,transform_.1s]" data-testid={testId}>
      {n}) {label}
      {done && <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--green)]" data-testid={`${testId}-done`} />}
      {extra}
    </button>
  </li>
);

// Before leaving: crew and provisions, each glowing its bubbles for 5 seconds when tapped and ticked green once done.
export const TripTodos = ({ boatId, online, single, provisioned }) => {
  const crew = useCrewCount(boatId, online);
  return (
    <ul className="flex flex-col gap-1.5 rounded-md border-[1.5px] border-[var(--line)] bg-white px-3 py-2" data-testid="trip-todos">
      <Todo n={1} label="Crew prep and invite" done={crew > 0 || single} testId="trip-todo-crew"
        extra={single && !crew ? <span className="no-underline" data-testid="trip-todo-crew-single">(S)</span> : null}
        onClick={() => spot(["route-crew-btn", "route-prep-btn", "route-roles-btn"])} />
      <Todo n={2} label="Provisioning" done={provisioned} testId="trip-todo-provisions" onClick={() => spot(["route-provisions-btn"])} />
    </ul>
  );
};
