import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Users } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextDialog } from "@/components/boat/TextDialog";
import { BoatPhoto } from "@/components/boat/BoatPhoto";
import { CrewDialog } from "@/components/boat/CrewDialog";
import { apiError } from "@/lib/api";

export const nameOf = (b) => b.vessel?.trim() || "Unnamed boat";
const BTN = "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 border-[var(--navy)] bg-white text-[var(--navy)] hover:bg-[var(--navy)] hover:text-white active:scale-95 [transition:background-color_.15s,color_.15s,transform_.1s]";

const BoatOption = ({ b }) => (
  <span className="flex min-w-0 items-center gap-2">
    <BoatPhoto boat={b} size="h-8 w-8" />
    <span className="min-w-0 truncate">{nameOf(b)}</span>
    {b.crew && <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold uppercase text-sky-900">Crew</span>}
  </span>
);

export const BoatSwitcher = ({ boats, state, premium, online, onUpgrade, onInviteUpgrade }) => {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const cur = boats.current;
  const currentName = nameOf(cur);
  const own = boats.boats.filter((b) => !b.crew);
  const canRemove = cur.crew || own.length > 1;

  const confirmAdd = (name) => {
    if (!name) return "Please enter the vessel name";
    if (boats.boats.some((b) => nameOf(b).toLowerCase() === name.toLowerCase())) return `${name} is already one of your boats`;
    boats.add(state, name);
    setAdding(false);
    toast.success(`${name} added, with a copy of ${currentName}'s lists`);
    return true;
  };
  const confirmDelete = async () => {
    setDeleting(false);
    if (!online) { toast.error(cur.crew ? "Go online to leave a boat" : "Go online to delete a boat"); return; }
    const next = boats.boats.find((b) => b.key !== cur.key && !b.crew) || boats.boats.find((b) => b.key !== cur.key);
    try { await boats.remove(cur); boats.select(next.key); toast.success(cur.crew ? `You've left ${currentName}` : `${currentName} deleted`); }
    catch (e) { toast.error(apiError(e, "Couldn't do that, please try again")); }
  };

  return (
    <div className="flex items-center gap-2" data-testid="boat-switcher">
      <Select value={cur.key} onValueChange={boats.select}>
        <SelectTrigger className="h-14 min-w-0 flex-1 rounded-md border-2 border-[var(--navy)] bg-white pl-2 font-display text-base font-bold text-[var(--navy)]" data-testid="boat-selector" aria-label="Boat">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {boats.boats.map((b) => (
            <SelectItem key={b.key} value={b.key} className="py-2 font-bold" data-testid={`boat-option-${b.key}`}><BoatOption b={b} /></SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!cur.crew && (
        <button type="button" className={BTN} onClick={() => setCrewOpen(true)} title="Photo and crew" aria-label="Photo and crew" data-testid="boat-crew-btn"><Users className="h-5 w-5" /></button>
      )}
      <button type="button" className={BTN} onClick={() => (premium ? setAdding(true) : onUpgrade())} title="Add a boat" aria-label="Add a boat" data-testid="add-boat-btn"><Plus className="h-5 w-5" strokeWidth={3} /></button>
      {canRemove && (
        <button type="button" className={`${BTN} hover:!border-[var(--red)] hover:!bg-[var(--red)]`} onClick={() => setDeleting(true)}
          title={cur.crew ? "Leave this boat" : "Delete this boat"} aria-label={cur.crew ? "Leave this boat" : "Delete this boat"} data-testid={cur.crew ? "leave-boat-btn" : "delete-boat-btn"}>
          {cur.crew ? <LogOut className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
        </button>
      )}
      <TextDialog open={adding} title="Add a boat" confirmLabel="Add boat" testId="add-boat" placeholder="Vessel name (e.g., Bacchus)"
        description={`Starts with a copy of ${currentName}'s lists, all unticked. Ship's Log, My To Do List, engine hours and callsign start empty.`}
        onConfirm={confirmAdd} onClose={() => setAdding(false)} />
      {!cur.crew && (
        <CrewDialog open={crewOpen} boat={cur} name={currentName} online={online} premium={premium} onUpgrade={onInviteUpgrade}
          onPhoto={(v) => boats.patch(cur.key, { photo_v: v })} onClose={() => setCrewOpen(false)} />
      )}
      <AlertDialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)}>
        <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="delete-boat-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold">{cur.crew ? `Leave ${currentName}?` : `Delete ${currentName}?`}</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-[var(--navy)]">
              {cur.crew ? "The boat disappears from your phone. The skipper can invite you again." : "All of this boat's lists, Ship's Log, engine hours, photo and crew are removed from this phone and the cloud. Your other boats are not changed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="delete-boat-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction className="btn-solid bg-[var(--red)] px-5" onClick={confirmDelete} data-testid="delete-boat-confirm-btn">{cur.crew ? "Leave boat" : "Delete boat"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
