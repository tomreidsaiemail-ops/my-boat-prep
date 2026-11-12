import { useEffect, useState } from "react";
import { ChevronRight, Loader2, MapPinned, Ship, Users } from "lucide-react";
import { api } from "@/lib/api";
import { boatKey } from "@/hooks/useBoats";

const Option = ({ icon: Icon, title, sub, badge, onClick, busy, testId }) => (
  <li>
    <button type="button" onClick={onClick} disabled={busy} className="flex w-full items-center gap-3 rounded-lg border-[1.5px] border-[var(--navy)] bg-white px-3 py-3 text-left [transition:transform_.1s,background-color_.15s] hover:bg-sky-50 active:scale-[.99]" data-testid={testId}>
      <Icon className="h-5 w-5 shrink-0 text-[var(--navy)]" />
      <span className="min-w-0 flex-1"><span className="block truncate font-bold">{title}</span>{sub && <span className="block truncate text-xs text-[var(--muted)]">{sub}</span>}</span>
      {badge && <span className="shrink-0 rounded-full bg-[var(--red)] px-2 py-0.5 text-[11px] font-extrabold text-white">{badge}</span>}
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
    </button>
  </li>
);

const Group = ({ title, children, testId }) => (
  <section className="flex flex-col gap-2" data-testid={testId}>
    <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">{title}</h2>
    <ul className="flex flex-col gap-2">{children}</ul>
  </section>
);

// Shown once per sign-in to a shore contact: their own boats, boats they crew on, and boats they watch from shore.
export const ShoreChooser = ({ shoreBoats, onApp, onShore }) => {
  const [mine, setMine] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { api.get("/me/boats").then(({ data }) => setMine(data.boats)).catch(() => setMine([])); }, []);
  if (mine === null || shoreBoats === null) return <Loader2 className="h-6 w-6 animate-spin" />;
  const own = mine.filter((b) => !b.crew);
  const crew = mine.filter((b) => b.crew);
  const watched = shoreBoats.map((b, i) => ({ ...b, i })).filter((b) => !b.mine);
  const go = (key) => { setBusy(key); onApp(key).finally(() => setBusy("")); };
  return (
    <div className="flex flex-col gap-5" data-testid="shore-chooser">
      <p className="text-sm text-slate-700">Choose a boat to open.</p>
      <Group title="My boats" testId="shore-chooser-own">
        {(own.length ? own : [{ boat_id: "main", vessel: "" }]).map((b) => (
          <Option key={b.boat_id} icon={Ship} title={b.vessel || "Unnamed boat"} sub={own.length ? "Your boat" : "Set up your own boat"} busy={busy === boatKey(b)} onClick={() => go(boatKey(b))} testId={`shore-chooser-own-${b.boat_id}`} />
        ))}
      </Group>
      {crew.length > 0 && (
        <Group title="Boats I crew on" testId="shore-chooser-crew">
          {crew.map((b) => <Option key={boatKey(b)} icon={Users} title={b.vessel || "Unnamed boat"} sub={b.owner_name && `Skipper ${b.owner_name}`} busy={busy === boatKey(b)} onClick={() => go(boatKey(b))} testId={`shore-chooser-crew-${b.owner_id}-${b.boat_id}`} />)}
        </Group>
      )}
      {watched.length > 0 && (
        <Group title="Boats I'm shore contact for" testId="shore-chooser-shore">
          {watched.map((b) => (
            <Option key={`${b.owner_id}-${b.boat_id}`} icon={MapPinned} title={b.vessel} sub={`Skipper ${b.skipper}`} badge={b.alert ? (b.alert.kind === "mayDay" ? "MAYDAY" : "PAN-PAN") : ""}
              onClick={() => onShore(b.i)} testId={`shore-chooser-shore-${b.owner_id}-${b.boat_id}`} />
          ))}
        </Group>
      )}
    </div>
  );
};
