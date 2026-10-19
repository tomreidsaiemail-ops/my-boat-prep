import { useEffect, useMemo, useRef, useState } from "react";
import useBoatStore from "@/hooks/useBoatStore";
import useGps from "@/hooks/useGps";
import useEmailSender from "@/hooks/useEmailSender";
import useTips, { TIPS_ID, TIPS_LIST } from "@/hooks/useTips";
import { TipsList } from "@/components/boat/TipsList";
import useMedia, { MEDIA_LISTS, mediaLabel } from "@/hooks/useMedia";
import { MediaList } from "@/components/boat/MediaList";
import useFaq, { FAQ_ID, FAQ_LIST, faqLabel } from "@/hooks/useFaq";
import { FaqList } from "@/components/boat/FaqList";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import { AdBanner } from "@/components/boat/AdBanner";
import { toast } from "sonner";
import { displayLabel, isOutdated, keepMine, resetLists, resetOptions, TEMPLATE_IDS } from "@/lib/defaults";
import { BoatSwitcher } from "@/components/boat/BoatSwitcher";
import { TemplateUpdateNote } from "@/components/boat/TemplateUpdateNote";
import { CrewBanner } from "@/components/boat/CrewBanner";
import { InventoryList } from "@/components/boat/InventoryList";
import { InventoryLocked } from "@/components/boat/InventoryLocked";
import { AreaFilter, AreaPicker, NO_AREA } from "@/components/boat/AreaFilter";
import { BoatWatermark } from "@/components/boat/BoatWatermark";
import useInventoryShared from "@/hooks/useInventoryShared";

const INVENTORY_LIST = { id: "boatInventory", name: "Boat Inventory", isInventory: true };
import useTemplates from "@/hooks/useTemplates";
import { PublishTemplateBar } from "@/components/boat/PublishTemplateBar";
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
import { ResetListsDialog } from "@/components/boat/ResetListsDialog";

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const verbose = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
const EMERGENCY = { mayDay: "red", panPan: "amber" };
const FREE_TODO_LIMIT = 5;

const useWarn = () => {
  const [warn, setWarn] = useState(null);
  const t = useRef();
  const show = (zone) => { setWarn(zone); clearTimeout(t.current); t.current = setTimeout(() => setWarn(null), 4000); };
  return [warn, show];
};

export default function BoatPrep({ boatId, boats }) {
  const { user } = useAuth();
  const { askUpgrade } = useUpgrade();
  const premium = !!user.premium;
  const needPro = (reason) => { if (premium) return true; askUpgrade(reason); return false; };
  const { state, mutate, pending, online, goOffline, goOnline, emailLog, crew } = useBoatStore(user.user_id, boats.current);
  const gps = useGps();
  const [activeId, setActiveId] = useState("leavingDock");
  const [warn, showWarn] = useWarn();
  const [dialog, setDialog] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [tripDate, setTripDate] = useState(todayISO);
  const VERBOSE_DATE = verbose(tripDate);
  const { tips, save: saveTips } = useTips(online);
  const media = useMedia(online);
  const { faq, save: saveFaq } = useFaq(online);
  const { templates, publish } = useTemplates(online);
  const inventoryShared = useInventoryShared(online);
  const [areaFilter, setAreaFilter] = useState("");
  const [editArea, setEditArea] = useState("");
  const { boat, registry } = state;
  const { setVessel } = boats;
  useEffect(() => { setVessel(boatId, boat.vessel); }, [boat.vessel, boatId, setVessel]);
  const updatedIds = registry.filter((l) => isOutdated(state, l.id, templates)).map((l) => l.id);
  const mediaData = Object.fromEntries(MEDIA_LISTS.map((l) => [l.id, media[l.id].items.map((m) => ({ id: m.id, label: mediaLabel(m) }))]));
  const areas = state.areas || [];
  const inventoryLines = areas.flatMap((a) => (a.items || []).map((i) => ({ id: i.id, label: `${a.name}: ${i.name} x${i.qty}`, checked: !!i.onboard })));
  const data = { ...state.data, [TIPS_ID]: tips, ...mediaData, [INVENTORY_LIST.id]: inventoryLines, [FAQ_ID]: faq.map((f) => ({ id: f.id, label: faqLabel(f) })) };
  const allLists = [...registry, INVENTORY_LIST, TIPS_LIST, ...MEDIA_LISTS, FAQ_LIST];
  const active = allLists.find((l) => l.id === activeId) || registry[0];
  const isTips = active.id === TIPS_ID;
  const items = data[active.id] || [];
  const tagging = premium && !crew && areas.length > 0;
  const areaName = (item) => areas.find((a) => a.id === item.area)?.name || null;
  const filterAreas = areas.filter((a) => items.some((i) => i.area === a.id));
  const shown = !areaFilter ? items : items.filter((i) => (areaFilter === NO_AREA ? !areaName(i) : i.area === areaFilter));
  useEffect(() => { setAreaFilter(""); }, [active.id]);
  const ctx = useMemo(() => ({ vessel: boat.vessel.trim(), callsign: boat.callsign.trim(), position: gps.text, verboseDate: VERBOSE_DATE }), [boat, gps.text, VERBOSE_DATE]);
  const labelFor = (item) => displayLabel(item, ctx);

  const ready = !!(boat.vessel.trim() && boat.skipper.trim() && boat.callsign.trim());
  const ownerOnly = (fn) => (...args) => (crew ? toast.info("On a shared boat, crew can tick items only") : fn(...args));
  const guard = (zone = "top") => {
    if (ready) return true;
    showWarn(zone);
    return false;
  };
  const setItems = (fn) => mutate((s) => ({ ...s, data: { ...s.data, [active.id]: fn(s.data[active.id] || []) } }));
  const isDup = (text, exceptId) => items.some((i) => i.id !== exceptId && i.label.toLowerCase() === text.toLowerCase());

  const toggle = (id) => guard() && setItems((list) => list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const remove = (id) => guard() && setItems((list) => list.filter((i) => i.id !== id));
  const flag = (id) => guard() && setItems((list) => {
    const it = list.find((i) => i.id === id);
    if (it.flagged) return list.map((i) => (i.id === id ? { ...i, flagged: false } : i));
    return [{ ...it, flagged: true }, ...list.filter((i) => i.id !== id)];
  });
  const move = (id, dir) => guard() && setItems((list) => {
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const reset = ownerOnly((zone) => guard(zone) && setDialog({ type: "reset" }));
  const confirmReset = (ids) => {
    mutate((s) => resetLists(s, ids, templates));
    setDialog(null);
    toast.success(ids.length === 1 ? `${resetOptions(state).find((o) => o.id === ids[0])?.name} reset` : `${ids.length} lists reset`);
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
  const exportLists = (current, zone) => guard(zone) && (current || needPro("Export All lists")) && setPrintMode(current ? "current" : "all");
  const addItem = (text) => {
    if (!guard("bottom")) return null;
    if (!text) return "Nothing to add";
    if (isDup(text)) return `${text} already exists`;
    if (active.id === "myTodo" && !premium && items.length >= FREE_TODO_LIMIT) {
      askUpgrade("More than 5 To Do items");
      return `The Free plan holds ${FREE_TODO_LIMIT} To Do items. Go Pro for unlimited.`;
    }
    setItems((list) => [...list, { id: Date.now(), label: text, checked: false }]);
    return true;
  };
  const saveEdit = (item) => (text) => {
    if (!text) return "Item text cannot be empty";
    if (isDup(text, item.id)) return `${text} already exists`;
    setItems((list) => list.map((i) => {
      if (i.id !== item.id) return i;
      const { dynamic, area, ...rest } = i;
      return { ...rest, label: text, ...(editArea ? { area: editArea } : {}) };
    }));
    setDialog(null);
    return true;
  };
  const createList = (name) => {
    if (!name) return "Please enter a list name";
    if (allLists.some((l) => l.name.toLowerCase() === name.toLowerCase())) return `${name} already exists`;
    const id = `custom_${Date.now()}`;
    mutate((s) => ({ ...s, registry: [...s.registry, { id, name, isSystem: false }], data: { ...s.data, [id]: [] } }));
    setActiveId(id);
    setDialog(null);
    return true;
  };
  const NO_CLONE = { myTodo: "My To Do List and Ship's Log cannot be cloned", shipsLog: "My To Do List and Ship's Log cannot be cloned",
    mayDay: "May Day and Pan Pan cannot be cloned", panPan: "May Day and Pan Pan cannot be cloned", boatInventory: "Boat Inventory cannot be cloned" };
  const askClone = () => {
    if (active.isShared) { toast.warning("Skipper's Tips, Sailing YouTube Channels, Sailing Movies and FAQ are admin lists and cannot be cloned"); return; }
    if (NO_CLONE[active.id]) { toast.warning(NO_CLONE[active.id]); return; }
    if (needPro("Clone lists") && guard()) setDialog({ type: "clone", list: active });
  };
  const cloneList = (name) => {
    const source = dialog.list;
    if (!name) return "Please enter a list name";
    if (allLists.some((l) => l.name.toLowerCase() === name.toLowerCase())) return `${name} already exists`;
    const id = `custom_${Date.now()}`;
    mutate((s) => ({ ...s, registry: [...s.registry, { id, name, isSystem: false }],
      data: { ...s.data, [id]: (s.data[source.id] || []).map((i) => ({ id: i.id, label: i.label, checked: false })) } }));
    setActiveId(id);
    setDialog(null);
    toast.success(`${name} created from ${source.name}`);
    return true;
  };
  const askRename = () => {
    if (active.isShared) { toast.warning("Skipper's Tips, Sailing YouTube Channels, Sailing Movies and FAQ are admin lists and cannot be renamed"); return; }
    if (active.isInventory) { toast.warning("Boat Inventory cannot be renamed"); return; }
    if (needPro("Rename lists") && guard()) setDialog({ type: "rename", list: active });
  };
  const renameList = (name) => {
    const { id, name: old } = dialog.list;
    if (!name) return "Please enter a list name";
    if (allLists.some((l) => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) return `${name} already exists`;
    if (name !== old) {
      mutate((s) => ({ ...s, registry: s.registry.map((l) => (l.id === id ? { ...l, name } : l)) }));
      toast.success(`${old} renamed to ${name}`);
    }
    setDialog(null);
    return true;
  };
  const getLatest = () => {
    if (!guard()) return;
    mutate((s) => resetLists(s, [active.id], templates));
    toast.success(`${active.name} now has the latest master items`);
  };
  const publishTemplate = async (id, list) => {
    const res = await publish(id, list);
    mutate((s) => ({ ...s, template_versions: { ...(s.template_versions || {}), [id]: res.updated_at } }));
    return res;
  };
  const openFaq = () => {
    setActiveId(FAQ_ID);
    setTimeout(() => document.querySelector('[data-testid="list-selector"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
          onEmail={ownerOnly(() => needPro("Email PDF") && mail.requestSend(ids, title))} online={online} sending={mail.sending}
          emailed={mail.sentKey === ids.join(",")} locked={!premium} />
        {emailPrompt}
      </>
    );
  }

  return (
    <main className="relative mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-5" data-testid="boat-prep-app">
      <BoatWatermark boat={boats.current} />
      <Header gps={gps} online={online} pending={pending} onGoOffline={goOffline} onGoOnline={goOnline} tripDate={tripDate} onDateChange={setTripDate} onOpenFaq={openFaq} />
      <SyncBanner online={online} pending={pending} />
      <BoatSwitcher boats={boats} state={state} premium={premium} online={online} onUpgrade={() => askUpgrade("More than one boat")} onInviteUpgrade={() => askUpgrade("Crew sharing")} />
      {crew ? <CrewBanner boat={boat} owner={boats.current.owner_name} /> : <BoatDetails boat={boat} onChange={updateBoat} />}
      <ActionBar zone="top" warn={warn === "top" && !ready} onReset={() => reset("top")} onExport={(c) => exportLists(c, "top")} locked={!premium} />
      <ListSelector registry={allLists} activeId={active.id} onChange={setActiveId} onCreate={ownerOnly(() => needPro("Create your own lists") && guard() && setDialog({ type: "list" }))} onClone={ownerOnly(askClone)} onRename={ownerOnly(askRename)} updatedIds={updatedIds} />
      <ListIntro key={`intro-${active.id}`} listId={active.id} canHide={premium} onLockedHide={() => askUpgrade("Hide help panels")}
        skipperChecked={state.emergency_checked?.[active.id]} onSkipperCheck={crew ? ownerOnly(() => {}) : (v) => mutate((s) => ({ ...s, emergency_checked: { ...(s.emergency_checked || {}), [active.id]: v } }))} />
      {!crew && updatedIds.includes(active.id) && (
        <TemplateUpdateNote key={`tpl-${active.id}`} listName={active.name} onGetLatest={getLatest}
          onKeepMine={() => mutate((s) => keepMine(s, active.id, templates))} />
      )}
      {!crew && active.id === "shipsLog" && (
        <EmailLogPanel email={boat.log_email || ""} shore={boat.shore_email || ""} onShoreChange={(v) => updateBoat("shore_email", v)}
          shoreOn={!!boat.shore_enabled} onShoreToggle={(v) => updateBoat("shore_enabled", v)} online={online} logSent={state.log_sent} busy={mail.sending}
          onSend={() => needPro("Email Ship's Log") && guard() && mail.requestSend(["shipsLog"], "Ship's Log")} locked={!premium} />
      )}
      {!crew && active.id === "engineService" && (
        <EngineHoursPanel entries={state.engine_log || []} today={todayISO()}
          onAdd={(entry) => (guard() ? mutate((s) => ({ ...s, engine_log: [...(s.engine_log || []), entry] })) : false)}
          onDelete={(id) => guard() && mutate((s) => ({ ...s, engine_log: (s.engine_log || []).filter((e) => e.id !== id) }))} />
      )}
      {isTips ? <TipsList tips={tips} admin={!!user.is_admin} online={online} onSave={saveTips} />
        : active.id === FAQ_ID ? <FaqList faq={faq} admin={!!user.is_admin} online={online} onSave={saveFaq} />
        : active.isMedia ? <MediaList key={active.id} list={active} store={media[active.id]} admin={!!user.is_admin} online={online} />
        : active.isInventory ? (premium
          ? <InventoryList areas={areas} readOnly={crew} admin={!!user.is_admin && !crew} online={online} shared={inventoryShared.shared} onSharedChange={inventoryShared.update}
              onChange={(fn) => mutate((s) => ({ ...s, areas: fn(s.areas || []) }))} />
          : <InventoryLocked onUpgrade={() => askUpgrade("Boat inventory")} />) : (
        <>
          {premium && filterAreas.length > 0 && <AreaFilter areas={filterAreas} value={areaFilter} onChange={setAreaFilter} />}
          {areaFilter && shown.length === 0 ? <p className="rounded-lg border-[1.5px] border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]" data-testid="area-filter-empty">No items in this area.</p> : (
          <Checklist items={shown} labelFor={labelFor} emergency={EMERGENCY[active.id]} tickOnly={crew} areaOf={premium ? areaName : undefined}
            onToggle={toggle} onDelete={remove} onEdit={(item) => { if (guard()) { setEditArea(item.area && areaName(item) ? item.area : ""); setDialog({ type: "edit", item }); } }} onDeleteList={askDeleteList}
            {...(active.id === "myTodo" && !areaFilter ? { onFlag: flag, onMove: move } : {})} />)}
          {!crew && <AddItemForm key={`add-${active.id}`} onAdd={addItem}
            placeholder={{ shipsLog: "My own Ship's Log...", myTodo: "Note a little issue to fix..." }[active.id] || `My own ${active.name} task name...`} />}
        </>
      )}
      {user.is_admin && !crew && TEMPLATE_IDS.includes(active.id) && (
        <PublishTemplateBar list={active} items={items} template={templates[active.id]} online={online} onPublish={publishTemplate} />
      )}
      <ActionBar zone="bottom" warn={warn === "bottom" && !ready} onReset={() => reset("bottom")} onExport={(c) => exportLists(c, "bottom")} locked={!premium} />
      {!premium && <AdBanner online={online} onRemoveAds={() => askUpgrade("Removing ads")} />}
      <TextDialog open={dialog?.type === "list"} title="Create New List" placeholder="Enter new list name (e.g., Engine)" testId="create-list"
        onConfirm={createList} onClose={() => setDialog(null)} />
      <TextDialog open={dialog?.type === "clone"} title="Clone List" confirmLabel="Clone" testId="clone-list"
        description={dialog?.type === "clone" ? `Make a separate copy of ${dialog.list.name}, with every item unticked.` : ""}
        initial={dialog?.type === "clone" ? `My ${dialog.list.name}` : ""}
        onConfirm={dialog?.type === "clone" ? cloneList : () => true} onClose={() => setDialog(null)} />
      <TextDialog open={dialog?.type === "rename"} title="Rename List" confirmLabel="Save" testId="rename-list"
        initial={dialog?.type === "rename" ? dialog.list.name : ""}
        onConfirm={dialog?.type === "rename" ? renameList : () => true} onClose={() => setDialog(null)} />
      <TextDialog open={dialog?.type === "edit"} title="Edit Item" confirmLabel="Save" testId="edit-item"
        initial={dialog?.type === "edit" ? labelFor(dialog.item) : ""}
        onConfirm={dialog?.type === "edit" ? saveEdit(dialog.item) : () => true} onClose={() => setDialog(null)}>
        {tagging && <AreaPicker areas={areas} value={editArea} onChange={setEditArea} />}
      </TextDialog>
      <ResetListsDialog open={dialog?.type === "reset"} options={resetOptions(state)} onConfirm={confirmReset} onClose={() => setDialog(null)} />
      <DeleteListDialog list={dialog?.type === "deleteList" ? dialog.list : null} onConfirm={deleteList} onClose={() => setDialog(null)} />
      {emailPrompt}
    </main>
  );
}
