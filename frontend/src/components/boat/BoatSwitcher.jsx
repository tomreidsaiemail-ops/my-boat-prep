import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, Ship, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TextDialog } from "@/components/boat/TextDialog";

const nameOf = (b) => b.vessel?.trim() || "Unnamed boat";
const BTN = "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 border-[var(--navy)] bg-white text-[var(--navy)] hover:bg-[var(--navy)] hover:text-white active:scale-95 [transition:background-color_.15s,color_.15s,transform_.1s]";

export const BoatSwitcher = ({ boats, state, premium, online, onUpgrade }) => {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const currentName = nameOf(boats.boats.find((b) => b.boat_id === boats.activeId) || {});

  const askAdd = () => (premium ? setAdding(true) : onUpgrade());
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
    if (!online) { toast.error("Go online to delete a boat"); return; }
    const next = boats.boats.find((b) => b.boat_id !== boats.activeId);
    try { await boats.remove(boats.activeId); boats.select(next.boat_id); toast.success(`${currentName} deleted`); }
    catch (e) { toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Couldn't delete the boat, please try again"); }
  };

  return (
    <div className="flex items-center gap-2" data-testid="boat-switcher">
      <Ship className="h-5 w-5 shrink-0 text-[var(--navy)]" aria-hidden="true" />
      <div className="relative min-w-0 flex-1">
        <select data-testid="boat-selector" aria-label="Boat" value={boats.activeId} onChange={(e) => boats.select(e.target.value)}
          className="h-12 w-full appearance-none truncate rounded-md border-2 border-[var(--navy)] bg-white pl-3 pr-9 font-display text-base font-bold text-[var(--navy)] focus:outline-none focus:ring-4 focus:ring-[var(--blue)]/30">
          {boats.boats.map((b) => <option key={b.boat_id} value={b.boat_id}>{nameOf(b)}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2" />
      </div>
      <button type="button" className={BTN} onClick={askAdd} title="Add a boat" aria-label="Add a boat" data-testid="add-boat-btn"><Plus className="h-5 w-5" strokeWidth={3} /></button>
      {boats.boats.length > 1 && (
        <button type="button" className={`${BTN} hover:!bg-[var(--red)] hover:!border-[var(--red)]`} onClick={() => setDeleting(true)} title="Delete this boat" aria-label="Delete this boat" data-testid="delete-boat-btn">
          <Trash2 className="h-5 w-5" />
        </button>
      )}
      <TextDialog open={adding} title="Add a boat" confirmLabel="Add boat" testId="add-boat" placeholder="Vessel name (e.g., Bacchus)"
        description={`Starts with a copy of ${currentName}'s lists, all unticked. Ship's Log, My To Do List, engine hours and callsign start empty.`}
        onConfirm={confirmAdd} onClose={() => setAdding(false)} />
      <AlertDialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)}>
        <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="delete-boat-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold">Delete {currentName}?</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-[var(--navy)]">All of this boat&apos;s lists, Ship&apos;s Log and engine hours are removed from this phone and the cloud. Your other boats are not changed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="delete-boat-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction className="btn-solid bg-[var(--red)] px-5" onClick={confirmDelete} data-testid="delete-boat-confirm-btn">Delete boat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
