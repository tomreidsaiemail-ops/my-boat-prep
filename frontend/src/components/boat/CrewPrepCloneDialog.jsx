import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { InviteCrewDialog } from "@/components/boat/InviteCrewDialog";

const crewNames = (info) => [...new Set([...info.crew.map((m) => m.name || m.email), ...info.invites.filter((i) => !i.declined_at).map((i) => i.name || i.email)]
  .map((s) => String(s || "").trim()).filter(Boolean))];

const NoCrew = ({ onInvite, onClose }) => (
  <div className="flex flex-col gap-3" data-testid="crew-clone-empty">
    <div role="alert" className="flex items-start gap-2 rounded-md border-[1.5px] border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>You haven't added any crew yet. Each crew member gets their own Crew Prep list, so invite your crew first. Invite crew now?</p>
    </div>
    <div className="flex gap-2">
      <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="crew-clone-no-btn">No</button>
      <button type="button" className="btn-solid h-11 flex-1 justify-center gap-2" onClick={onInvite} data-testid="crew-clone-invite-btn"><UserPlus className="h-4 w-4" /> Yes, invite crew</button>
    </div>
  </div>
);

const Picker = ({ people, listName, exists, picked, setPicked }) => (
  <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-md border-[1.5px] border-[var(--line)]" data-testid="crew-clone-people">
    {people.map((p, n) => {
      const done = exists(`${listName} - ${p}`);
      return (
        <li key={p}>
          <label className={`flex items-center gap-3 px-3 py-2.5 ${done ? "opacity-60" : "cursor-pointer"}`}>
            <input type="checkbox" disabled={done} checked={done || picked.includes(p)} onChange={() => setPicked((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))}
              className="h-5 w-5 accent-[var(--navy)]" data-testid={`crew-clone-person-${n}`} />
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{listName} - {p}</span>
            {done && <span className="text-xs text-[var(--muted)]">already made</span>}
          </label>
        </li>
      );
    })}
  </ul>
);

export const CrewPrepCloneDialog = ({ boat, vessel, roleGroups, online, premium, onUpgrade, listName, exists, onClone, onClose }) => {
  const [info, setInfo] = useState(null);
  const [picked, setPicked] = useState([]);
  const [inviting, setInviting] = useState(false);
  const invited = useRef([]);
  const load = useCallback(() => api.get(`/boats/${boat.boat_id}/crew`).then(({ data }) => setInfo(data)).catch(() => setInfo({ crew: [], invites: [], role_options: [] })), [boat.boat_id]);
  useEffect(() => { if (online) load(); }, [online, load]);
  const people = info ? crewNames(info) : [];
  const invite = () => (premium ? setInviting(true) : onUpgrade());
  const closeInvite = () => {
    setInviting(false);
    const names = [...new Set(invited.current)].map((p) => `${listName} - ${p}`).filter((n) => !exists(n));
    invited.current = [];
    if (names.length) onClone(names);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !inviting && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="crew-clone-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Clone {listName}</DialogTitle>
          <DialogDescription className="text-left text-sm">Pick who gets their own copy of {listName}, with every item unticked.</DialogDescription>
        </DialogHeader>
        {!online && <p className="text-sm text-[var(--muted)]" data-testid="crew-clone-offline">You need a signal to see your crew.</p>}
        {online && !info && <Loader2 className="mx-auto h-6 w-6 animate-spin" data-testid="crew-clone-loading" />}
        {info && !people.length && <NoCrew onInvite={invite} onClose={onClose} />}
        {info && people.length > 0 && <>
          <Picker people={people} listName={listName} exists={exists} picked={picked} setPicked={setPicked} />
          <button type="button" className="btn-ghost h-11 justify-center gap-2" onClick={invite} data-testid="crew-clone-invite-more-btn"><UserPlus className="h-4 w-4" /> Invite more crew</button>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="crew-clone-cancel-btn">Cancel</button>
            <button type="button" className="btn-solid h-11 flex-1 justify-center" disabled={!picked.length} onClick={() => onClone(picked.map((p) => `${listName} - ${p}`))} data-testid="crew-clone-confirm-btn">
              Clone {picked.length > 1 ? `${picked.length} lists` : "list"}
            </button>
          </div>
        </>}
        <InviteCrewDialog open={inviting} boat={boat} name={vessel} info={info || { crew: [], invites: [], role_options: [] }} roleGroups={roleGroups} online={online} premium={premium}
          onUpgrade={onUpgrade} onInvited={(p) => { if (p?.name) invited.current.push(p.name); load(); }} onClose={closeInvite} />
      </DialogContent>
    </Dialog>
  );
};
