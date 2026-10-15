import { useMemo, useRef, useState } from "react";
import useBoatStore from "@/hooks/useBoatStore";
import useGps from "@/hooks/useGps";
import useEmailSender from "@/hooks/useEmailSender";
import { toast } from "sonner";
import { displayLabel, restoreDeletedLists } from "@/lib/defaults";
import { Header } from "@/components/boat/Header";
import { BoatDetails } from "@/components/boat/BoatDetails";
import { ActionBar } from "@/components/boat/ActionBar";
import { SyncBanner } from "@/components/boat/SyncBanner";
import { ListSelector } from "@/components/boat/ListSelector";
import { ListIntro } from "@/components/boat/ListIntro";
import { Checklist } from "@/components/boat/Checklist";
import { AddItemForm } from "@/components/boat/AddItemForm";
import { TextDialog } from "@/components/boat/TextDialog";
import { PrintView } from "@/components/boat/PrintView";
import { EmailLogPanel } from "@/components/boat/EmailLogPanel";
import { EngineHoursPanel } from "@/components/boat/EngineHoursPanel";
import { DeleteListDialog } from "@/components/boat/DeleteListDialog";

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const verbose = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
const EMERGENCY = { mayDay: "red", panPan: "amber" };

const useWarn = () => {
  const [warn, setWarn] = useState(null);
  const t = useRef();
  const show = (zone) => { setWarn(zone); clearTimeout(t.current); t.current = setTimeout(() => setWarn(null), 4000); };
  return [warn, show];
};

export default function BoatPrep() {
  const { state, mutate, pending, online, goOffline, goOnline, emailLog } = useBoatStore();
  const gps = useGps();
  const [activeId, setActiveId] = useState("leavingDock");
  const [warn, showWarn] = useWarn();
  const [dialog, setDialog] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [tripDate, setTripDate] = useState(todayISO);
  const VERBOSE_DATE = verbose(tripDate);
  const { boat, registry, data } = state;
  const active = registry.find((l) => l.id === activeId) || registry[0];
  const items = data[active.id] || [];
  const ctx = useMemo(() => ({ vessel: boat.vessel.trim(), callsign: boat.callsign.trim(), position: gps.text, verboseDate: VERBOSE_DATE }), [boat, gps.text, VERBOSE_DATE]);
  const labelFor = (item) => displayLabel(item, ctx);

  const ready = !!(boat.vessel.trim() && boat.skipper.trim() && boat.callsign.trim());
  const guard = (zone = "top") => {
    if (ready) return true;
    showWarn(zone);
    return false;
  };
  const setItems = (fn) => mutate((s) => ({ ...s, data: { ...s.data, [active.id]: fn(s.data[active.id] || []) } }));
  const isDup = (text, exceptId) => items.some((i) => i.id !== exceptId && i.label.toLowerCase() === text.toLowerCase());

  const toggle = (id) => guard() && setItems((list) => list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const remove = (id) => guard() && setItems((list) => list.filter((i) => i.id !== id));
  const reset = (zone) => {
    if (!guard(zone)) return;
    const { names } = restoreDeletedLists(state);
    mutate((s) => {
      const r = restoreDeletedLists(s).state;
      return { ...r, data: { ...r.data, [active.id]: (r.data[active.id] || []).map((i) => ({ ...i, checked: false })) } };
    });
    if (names.length) toast.success(`Restored: ${names.join(", ")}`);
  };
  const askDeleteList = () => {
    if (!guard()) return;
    if (registry.length <= 1) { toast.error("You need to keep at least one list"); return; }
    setDialog({ type: "deleteList", list: active });
  };
  const deleteList = () => {
    const { id, isSystem } = dialog.list;
    const idx = registry.findIndex((l) => l.id === id);
    const next = registry[idx + 1] || registry[idx - 1];
    mutate((s) => {
      const data = { ...s.data };
      delete data[id];
      return { ...s, registry: s.registry.filter((l) => l.id !== id), data, deleted_lists: isSystem ? [...(s.deleted_lists || []), id] : s.deleted_lists || [] };
    });
    setActiveId(next.id);
    setDialog(null);
    toast.success(`${dialog.list.name} deleted`);
  };
  const exportLists = (current, zone) => guard(zone) && setPrintMode(current ? "current" : "all");
  const addItem = (text) => {
    if (!guard("bottom")) return null;
    if (!text) return "Nothing to add";
    if (isDup(text)) return `${text} already exists`;
    setItems((list) => [...list, { id: Date.now(), label: text, checked: false }]);
    return true;
  };
  const saveEdit = (item) => (text) => {
    if (!text) return "Item text cannot be empty";
    if (isDup(text, item.id)) return `${text} already exists`;
    setItems((list) => list.map((i) => (i.id === item.id ? { id: i.id, checked: i.checked, label: text } : i)));
    setDialog(null);
    return true;
  };
  const createList = (name) => {
    if (!name) return "Please enter a list name";
    if (registry.some((l) => l.name.toLowerCase() === name.toLowerCase())) return `${name} already exists`;
    const id = `custom_${Date.now()}`;
    mutate((s) => ({ ...s, registry: [...s.registry, { id, name, isSystem: false }], data: { ...s.data, [id]: [] } }));
    setActiveId(id);
    setDialog(null);
    return true;
  };
  const updateBoat = (key, value) => mutate((s) => ({ ...s, boat: { ...s.boat, [key]: value } }), { count: false });
  const mail = useEmailSender({ savedEmail: boat.log_email, saveEmail: (v) => updateBoat("log_email", v), emailLog, localDate: VERBOSE_DATE, position: gps.text });
  const emailPrompt = (
    <TextDialog open={!!mail.prompt} title="Where should we send it?" description="Enter the email address for your PDFs. It's saved next to Skipper for next time."
      inputType="email" placeholder="you@email.com" confirmLabel="Send" testId="email-prompt" initial={mail.prompt?.initial || ""}
      onConfirm={mail.confirmEmail} onClose={mail.closePrompt} />
  );

  if (printMode) {
    const lists = printMode === "current" ? [active] : registry;
    const title = printMode === "current" ? active.name : "Vessel Manifest Master Logs";
    const ids = lists.map((l) => l.id);
    return (
      <>
        <PrintView lists={lists} data={data} labelFor={labelFor} boat={boat} verboseDate={VERBOSE_DATE} title={title} onBack={() => setPrintMode(null)}
          onEmail={() => mail.requestSend(ids, title)} online={online} sending={mail.sending} emailed={mail.sentKey === ids.join(",")} />
        {emailPrompt}
      </>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-5" data-testid="boat-prep-app">
      <Header gps={gps} online={online} pending={pending} onGoOffline={goOffline} onGoOnline={goOnline} tripDate={tripDate} onDateChange={setTripDate} />
      <SyncBanner online={online} pending={pending} />
      <BoatDetails boat={boat} onChange={updateBoat} />
      <ActionBar zone="top" warn={warn === "top" && !ready} onReset={() => reset("top")} onExport={(c) => exportLists(c, "top")} />
      <ListSelector registry={registry} activeId={active.id} onChange={setActiveId} onCreate={() => guard() && setDialog({ type: "list" })} />
      <ListIntro key={`intro-${active.id}`} listId={active.id} />
      {active.id === "shipsLog" && (
        <EmailLogPanel email={boat.log_email || ""} shore={boat.shore_email || ""} onShoreChange={(v) => updateBoat("shore_email", v)}
          shoreOn={!!boat.shore_enabled} onShoreToggle={(v) => updateBoat("shore_enabled", v)} online={online} logSent={state.log_sent} busy={mail.sending}
          onSend={() => guard() && mail.requestSend(["shipsLog"], "Ship's Log")} />
      )}
      {active.id === "engineService" && (
        <EngineHoursPanel entries={state.engine_log || []} today={todayISO()}
          onAdd={(entry) => (guard() ? mutate((s) => ({ ...s, engine_log: [...(s.engine_log || []), entry] })) : false)}
          onDelete={(id) => guard() && mutate((s) => ({ ...s, engine_log: (s.engine_log || []).filter((e) => e.id !== id) }))} />
      )}
      <Checklist items={items} labelFor={labelFor} emergency={EMERGENCY[active.id]}
        onToggle={toggle} onDelete={remove} onEdit={(item) => guard() && setDialog({ type: "edit", item })} onDeleteList={askDeleteList} />
      <AddItemForm key={`add-${active.id}`} onAdd={addItem}
        placeholder={{ shipsLog: "My own Ship's Log...", myTodo: "Note a little issue to fix..." }[active.id] || `My own ${active.name} task name...`} />
      <ActionBar zone="bottom" warn={warn === "bottom" && !ready} onReset={() => reset("bottom")} onExport={(c) => exportLists(c, "bottom")} />
      <TextDialog open={dialog?.type === "list"} title="Create New List" placeholder="Enter new list name (e.g., Engine)" testId="create-list"
        onConfirm={createList} onClose={() => setDialog(null)} />
      <TextDialog open={dialog?.type === "edit"} title="Edit Item" confirmLabel="Save" testId="edit-item"
        initial={dialog?.type === "edit" ? labelFor(dialog.item) : ""}
        onConfirm={dialog?.type === "edit" ? saveEdit(dialog.item) : () => true} onClose={() => setDialog(null)} />
      <DeleteListDialog list={dialog?.type === "deleteList" ? dialog.list : null} onConfirm={deleteList} onClose={() => setDialog(null)} />
      {emailPrompt}
    </main>
  );
}
