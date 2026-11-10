import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Users } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextDialog } from "@/components/boat/TextDialog";
import { DeletedBoats } from "@/components/boat/DeletedBoats";
import { BoatPhoto } from "@/components/boat/BoatPhoto";
import { CrewDialog } from "@/components/boat/CrewDialog";
import { apiError } from "@/lib/api";
import { roleBriefings, roleGroups } from "@/lib/crewRoles";
import { routeNotes } from "@/lib/routeNotes";
import { tripsWithPlans } from "@/lib/trips";

export const nameOf = (b) => b.vessel?.trim() || "New boat (add a name)";
const BTN = "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 border-[var(--navy)] bg-white text-[var(--navy)] hover:bg-[var(--navy)] hover:text-white active:scale-95 [transition:background-color_.15s,color_.15s,transform_.1s]";

const BoatOption = ({ b }) => (
  <span className="flex min-w-0 items-center gap-2">
    <BoatPhoto boat={b} size="h-8 w-8" />
    <span className="min-w-[5rem] truncate">{nameOf(b)}</span>
    {b.crew && <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold uppercase text-sky-900">Crew</span>}
    {b.charter && (b.charter.returned_at
      ? <span className="min-w-0 truncate rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-800" data-testid="boat-charter-ended-badge">Charter ended</span>
      : <span className="min-w-0 truncate rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-900" data-testid="boat-charter-skipper-badge">Charter skipper</span>)}
    {b.charter_lock && <span className="min-w-0 truncate rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-800" data-testid="boat-on-charter-badge">On charter</span>}
  </span>
);

export const BoatSwitcher = ({ boats, state, premium, online, onUpgrade, onInviteUpgrade, onSaveBriefing, knownRole, onAddAreas }) => {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [crewOpen, setCrewOpen] = useState(false);
  const [startInvite, setStartInvite] = useState(false);
  // "Back to Invite crew" after changing the available roles reopens the invite where the skipper left it.
  useEffect(() => {
    const reopen = () => { setStartInvite(true); setCrewOpen(true); };
    const openCrew = () => setCrewOpen(true);
    window.addEventListener("mbp:open-invite", reopen);
    window.addEventListener("mbp:open-crew", openCrew);
    return () => { window.removeEventListener("mbp:open-invite", reopen); window.removeEventListener("mbp:open-crew", openCrew); };
  }, []);
  const cur = boats.current;
  const currentName = nameOf(cur);
  const own = boats.boats.filter((b) => !b.crew);
  const canRemove = cur.crew || (own.length > 1 && !(cur.charter && !cur.charter.returned_at));
  // A boat with zone maps or cupboards needs its name typed before it can be deleted.
  const maps = (cur.zone_maps || []).length;
  const cupboards = (state?.areas || []).filter((a) => !a.parent_id).length;
  const guarded = !cur.crew && (maps > 0 || cupboards > 0);
  const nameOk = !guarded || typed.trim().toLowerCase() === currentName.trim().toLowerCase();

  const confirmAdd = (name) => {
    if (!name) return "Please enter the vessel name";
    if (boats.boats.some((b) => nameOf(b).toLowerCase() === name.toLowerCase())) return `${name} is already one of your boats`;
    boats.add(state, name);
    setAdding(false);
    toast.success(`${name} added, with a copy of ${currentName}'s lists`);
    return true;
  };
  const confirmDelete = async (e) => {
    if (!nameOk) { e?.preventDefault(); return; }
    setDeleting(false);
    if (!online) { toast.error(cur.crew ? "Go online to leave a boat" : "Go online to delete a boat"); return; }
    const next = boats.boats.find((b) => b.key !== cur.key && !b.crew) || boats.boats.find((b) => b.key !== cur.key);
    const gone = { boat_id: cur.boat_id, name: currentName };
    try {
      await boats.remove(cur); boats.select(next.key);
      if (cur.crew) toast.success(`You've left ${currentName}`);
      else toast.success(`${currentName} deleted. You can bring it back for 7 days from Add a boat (+).`, {
        duration: 10000, action: { label: "Undo", onClick: () => bringBack(gone) },
      });
    }
    catch (e) { toast.error(apiError(e, "Couldn't do that, please try again")); }
  };
  const bringBack = async (b) => {
    try { await boats.restore(b.boat_id); toast.success(`${b.name || b.vessel || "Your boat"} is back`); }
    catch (e) { toast.error(apiError(e, "Couldn't bring it back, please try again")); }
  };
  const restoreFromList = async (b) => { await boats.restore(b.boat_id); setAdding(false); toast.success(`${b.vessel || "Your boat"} is back`); };

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
        <button type="button" className={`${BTN} hover:!border-[var(--red)] hover:!bg-[var(--red)]`} onClick={() => { setTyped(""); setDeleting(true); }}
          title={cur.crew ? "Leave this boat" : "Delete this boat"} aria-label={cur.crew ? "Leave this boat" : "Delete this boat"} data-testid={cur.crew ? "leave-boat-btn" : "delete-boat-btn"}>
          {cur.crew ? <LogOut className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
        </button>
      )}
      <TextDialog open={adding} title="Add a boat" confirmLabel="Add boat" testId="add-boat" placeholder="Vessel name (e.g., Bacchus)"
        description={`Starts with a copy of ${currentName}'s lists, all unticked. Ship's Log, My To Do List, engine hours and callsign start empty.`}
        onConfirm={confirmAdd} onClose={() => setAdding(false)}>
        <DeletedBoats open={adding} online={online} onRestore={restoreFromList} />
      </TextDialog>
      {!cur.crew && (
        <CrewDialog open={crewOpen} boat={cur} name={currentName} areas={state?.areas || []} onWalkSkip={(skip) => boats.patch(cur.key, { walk_skip: skip })} onMaps={(maps) => boats.patch(cur.key, { zone_maps: maps })} onAddAreas={onAddAreas} onCharterChange={() => boats.refresh()} plan={routeNotes(state.boat)} trips={tripsWithPlans(state)} roleGroups={roleGroups(state)} briefings={roleBriefings(state)} provisions={state?.data?.provisions || []} weightBoat={state?.boat} onSaveBriefing={onSaveBriefing} knownRole={knownRole} startInvite={startInvite} online={online} premium={premium} onUpgrade={onInviteUpgrade}
          onPhoto={(v) => boats.patch(cur.key, { photo_v: v })} onClose={() => { setCrewOpen(false); setStartInvite(false); }} />
      )}
      <AlertDialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)}>
        <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="delete-boat-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold">{cur.crew ? `Leave ${currentName}?` : `Delete ${currentName}?`}</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-[var(--navy)]">
              {cur.crew ? "The boat disappears from your phone. The skipper can invite you again." : "All of this boat's lists, Ship's Log, engine hours, photo and crew are removed from this phone and the cloud. You can bring it back within 7 days from Add a boat (+). Your other boats are not changed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {guarded && (
            <div className="flex flex-col gap-2" data-testid="delete-boat-guard">
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="delete-boat-guard-note">
                {currentName} has {[maps && `${maps} zone ${maps === 1 ? "map" : "maps"}`, cupboards && `${cupboards} ${cupboards === 1 ? "cupboard" : "cupboards"}`].filter(Boolean).join(" and ")}. To make sure this isn't a mistake, type the boat's name to delete it.
              </p>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={currentName} aria-label="Type the boat's name to confirm"
                autoComplete="off" className="field-input" data-testid="delete-boat-name-input" />
            </div>
          )}
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="delete-boat-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction className="btn-solid !bg-[var(--red)] px-5 disabled:opacity-40" disabled={!nameOk} onClick={confirmDelete} data-testid="delete-boat-confirm-btn">{cur.crew ? "Leave boat" : "Delete boat"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
