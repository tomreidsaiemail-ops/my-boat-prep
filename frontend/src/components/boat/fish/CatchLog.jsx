import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Fish, Loader2, Trash2 } from "lucide-react";
import { api, API, apiError } from "@/lib/api";
import { localWhen } from "@/lib/timeAgo";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { FishReport } from "@/components/boat/fish/FishReport";
import { CatchMap } from "@/components/boat/fish/CatchMap";
import { CatchOfTheTrip } from "@/components/boat/fish/CatchOfTheTrip";

// Every catch the Magic Fish Whisperer has looked at: photo, species, size, place and date.
export const CatchLog = ({ online, imperial, refreshKey, onCount, view = "list" }) => {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [doomed, setDoomed] = useState(null);
  useEffect(() => {
    if (!online) { setList((l) => l || []); return; }
    api.get("/me/catches").then(({ data }) => { setList(data.catches); onCount(data.catches.length); }).catch(() => setList((l) => l || []));
  }, [online, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setOpen(null), [view]);
  const remove = async () => {
    try {
      await api.delete(`/me/catches/${doomed.catch_id}`);
      const next = list.filter((c) => c.catch_id !== doomed.catch_id);
      setList(next); onCount(next.length); setOpen(null);
      toast.success("Catch removed from your log");
    } catch (e) { toast.error(apiError(e, "Couldn't remove that catch")); }
    setDoomed(null);
  };
  if (list === null) return <p className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading your catches...</p>;
  if (open) {
    return (
      <div className="flex flex-col gap-2" data-testid="catch-log-detail">
        <div className="flex items-center justify-between">
          <button type="button" className="btn-ghost h-10 gap-1 px-3 text-sm" onClick={() => setOpen(null)} data-testid="catch-log-back-btn"><ChevronLeft className="h-4 w-4" /> {view === "map" ? "Back to the map" : "All catches"}</button>
          <button type="button" className="icon-btn text-[var(--red)]" aria-label="Remove this catch" onClick={() => setDoomed({ ...open, name: open.report.species.common_name })} data-testid="catch-log-delete-btn"><Trash2 className="h-5 w-5" /></button>
        </div>
        <FishReport c={open} imperial={imperial} />
        <ConfirmDelete item={doomed} title="Remove this catch?" note="It will be removed from your catch log." onConfirm={remove} onClose={() => setDoomed(null)} testId="catch-delete" />
      </div>
    );
  }
  if (view === "map") return <CatchMap catches={list} imperial={imperial} onOpen={setOpen} />;
  if (!list.length) return <p className="rounded-md border-[1.5px] border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]" data-testid="catch-log-empty">No catches yet. Photo your first fish and it will be saved here.</p>;
  return (
    <div className="flex flex-col gap-3">
    <CatchOfTheTrip list={list} imperial={imperial} onOpen={setOpen} />
    <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="catch-log-list">
      {list.map((c) => (
        <li key={c.catch_id}>
          <button type="button" onClick={() => setOpen(c)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50" data-testid={`catch-${c.catch_id}`}>
            {c.has_photo ? <img src={`${API}/me/catches/${c.catch_id}/photo`} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md object-cover" />
              : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-sky-50"><Fish className="h-6 w-6" /></span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{c.report.species.common_name}</span>
              <span className="block truncate text-xs text-[var(--muted)]">{[c.report.size.length_cm && `${c.report.size.length_cm} cm`, c.report.size.weight_kg && `${c.report.size.weight_kg} kg`, c.report.place.name].filter(Boolean).join(" · ")}</span>
              <span className="block text-xs text-[var(--muted)]">{localWhen(c.created_at)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
    </div>
  );
};
