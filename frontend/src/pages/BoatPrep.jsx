import { useEffect, useMemo, useRef, useState } from "react";
import useBoatStore, { boatParams } from "@/hooks/useBoatStore";
import useGps from "@/hooks/useGps";
import useEmailSender from "@/hooks/useEmailSender";
import useTips, { TIPS_ID, TIPS_LIST } from "@/hooks/useTips";
import { TipsList } from "@/components/boat/TipsList";
import useMedia, { MEDIA_LISTS, mediaLabel } from "@/hooks/useMedia";
import { MediaList } from "@/components/boat/MediaList";
import { ownMediaStore, toOwnMedia } from "@/hooks/useOwnMedia";
import useFaq, { FAQ_ID, FAQ_LIST, faqLabel } from "@/hooks/useFaq";
import { FaqList } from "@/components/boat/FaqList";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import { AdBanner } from "@/components/boat/AdBanner";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { addTemplateLists, displayLabel, isOutdated, keepMine, resetLists, resetOptions, templateIds } from "@/lib/defaults";
import { BoatSwitcher } from "@/components/boat/BoatSwitcher";
import { TemplateUpdateNote } from "@/components/boat/TemplateUpdateNote";
import { CrewBanner } from "@/components/boat/CrewBanner";
import { VoyageCard } from "@/components/boat/VoyageCard";
import { InventoryList } from "@/components/boat/InventoryList";
import { InventoryLocked } from "@/components/boat/InventoryLocked";
import { AreaFilter, AreaPicker, NO_AREA } from "@/components/boat/AreaFilter";
import { BoatWatermark } from "@/components/boat/BoatWatermark";
import useInventoryShared from "@/hooks/useInventoryShared";
import useListOrdering, { useListSetting } from "@/hooks/useListOrdering";
import useFolds from "@/hooks/useFolds";
import { applyMove } from "@/lib/inventoryMove";

const INVENTORY_LIST = { id: "boatInventory", name: "Boat Inventory", isInventory: true };
import useTemplates from "@/hooks/useTemplates";
import { PublishTemplateBar } from "@/components/boat/PublishTemplateBar";
import { Header } from "@/components/boat/Header";
import { BoatDetails } from "@/components/boat/BoatDetails";
import { ActionBar } from "@/components/boat/ActionBar";
import { SyncBanner } from "@/components/boat/SyncBanner";
import { ListSelector } from "@/components/boat/ListSelector";
import { CrewOrganiseButton, OrganiseDialog } from "@/components/boat/OrganiseDialog";
import useListCategories from "@/hooks/useListCategories";
import useAdminLists from "@/hooks/useAdminLists";
import useCrewHidden from "@/hooks/useCrewHidden";
import { dropdownSections, organiseLists } from "@/lib/listCategories";
import { ListIntro } from "@/components/boat/ListIntro";
import { Checklist } from "@/components/boat/Checklist";
import { AddItemForm } from "@/components/boat/AddItemForm";
import { TextDialog } from "@/components/boat/TextDialog";
import { CreateListDialog } from "@/components/boat/CreateListDialog";
import { RenameListDialog } from "@/components/boat/RenameListDialog";
import { TopUpButton, TopUpDialog } from "@/components/boat/TopUpDialog";
import { MpaDialog } from "@/components/boat/MpaDialog";
import { DoctorAsk } from "@/components/boat/DoctorAsk";
import { NavigatorAsk } from "@/components/boat/NavigatorAsk";
import { MPA_KIND, MPA_NAME, isMealHead, mealPlanLists } from "@/lib/mpa";
import { Sparkles } from "lucide-react";
import { PrintView } from "@/components/boat/PrintView";
import { EmailLogPanel } from "@/components/boat/EmailLogPanel";
import { ServiceLogPanel } from "@/components/boat/ServiceLogPanel";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { DeleteGroupDialog } from "@/components/boat/DeleteGroupDialog";
import { MealTypePicker } from "@/components/boat/MealTypePicker";
import { DESCRIPTION_MAX } from "@/components/boat/ListDraftTools";
import { FoldAllButton } from "@/components/boat/FoldAllButton";
import { First5000Banner } from "@/components/boat/First5000Banner";
import { ITEM_MAX, flagOutline, insertSuggestions, linesToItems, moveOutline, outlineInfo, placeOutline, removeOutline, setIndent } from "@/lib/outline";
import { DeleteListDialog } from "@/components/boat/DeleteListDialog";
import { ResetListsDialog } from "@/components/boat/ResetListsDialog";

const SERVICE_LOGS = { engineService: "engine_log", electricalService: "electrical_log" };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const verbose = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
const EMERGENCY = { mayDay: "red", panPan: "amber" };
const MEDIA_KINDS = ["youtube", "movies"];
const NO_TOPUP = ["shipsLog", "myTodo"];
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
  const { state, mutate, pending, online, goOffline, goOnline, emailLog, crew, loaded } = useBoatStore(user.user_id, boats.current);
  const gps = useGps();
  const [activeId, setActiveId] = useState(premium ? "boatInventory" : "leavingDock");
  const [batchRequest, setBatchRequest] = useState(false);
  const openDistress = (id) => {
    const name = id === "mayDay" ? "Mayday" : "Pan-Pan";
    if (!allLists.some((l) => l.id === id)) {
      if (crew) { toast.error(`The ${name} list isn't on this boat`); return; }
      mutate((s) => resetLists(s, [id], templates));
      toast.success(`${name} list added back to this boat`);
    }
    setActiveId(id);
    setTimeout(() => document.querySelector('[data-testid="list-selector"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const startBatchScan = () => {
    if (!needPro("Boat inventory") || !guard()) return;
    if (!online) { toast.error("Batch Magic Scan needs a signal"); return; }
    setActiveId("boatInventory");
    setBatchRequest(true);
  };
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
  const [editMeal, setEditMeal] = useState(null);
  const { boat, registry } = state;
  const missingTemplates = loaded && !crew && !!addTemplateLists(state, templates);
  useEffect(() => { if (missingTemplates) mutate((s) => addTemplateLists(s, templates) || s); }, [missingTemplates, templates, mutate]);
  const { setVessel } = boats;
  useEffect(() => { setVessel(boatId, boat.vessel); }, [boat.vessel, boatId, setVessel]);
  const updatedIds = registry.filter((l) => isOutdated(state, l.id, templates)).map((l) => l.id);
  const mediaData = Object.fromEntries(MEDIA_LISTS.map((l) => [l.id, media[l.id].items.map((m) => ({ id: m.id, label: mediaLabel(m) }))]));
  const areas = state.areas || [];
  const linked = {};
  registry.forEach((l) => (state.data[l.id] || []).forEach((i) => {
    if (i.area && areas.some((a) => a.id === i.area)) (linked[i.area] ||= []).push({ key: `${l.id}-${i.id}`, listId: l.id, listName: l.name, item: i, text: i.label });
  }));
  const inventoryLines = areas.flatMap((a) => [
    ...(a.items || []).map((i) => ({ id: i.id, label: `${a.name}: ${i.name} x${i.qty}${i.removed ? " (removed for now)" : ""}`, checked: false })),
    ...(linked[a.id] || []).map((l) => ({ id: l.key, label: `${a.name}: ${l.listName} - ${l.text}`, checked: !!l.item.checked })),
  ]);
  const data = { ...state.data, [TIPS_ID]: tips, ...mediaData, [INVENTORY_LIST.id]: inventoryLines, [FAQ_ID]: faq.map((f) => ({ id: f.id, label: faqLabel(f) })) };
  const allLists = [...registry, INVENTORY_LIST, TIPS_LIST, ...MEDIA_LISTS, FAQ_LIST];
  const mealLists = mealPlanLists(registry, state.data);
  const provisionNames = (state.data.provisions || []).map((i) => (i.label || "").trim()).filter(Boolean);
  const saveMpa = (rows) => {
    const now = Date.now();
    const old = registry.find((l) => l.kind === MPA_KIND);
    const id = old?.id || `custom_${now}`;
    mutate((s) => ({ ...s, registry: old ? s.registry : [...s.registry, { id, name: MPA_NAME, isSystem: false, kind: MPA_KIND }],
      data: { ...s.data, [id]: rows.map((r, n) => ({ id: now + n, ...r })) } }));
    setActiveId(id);
    setDialog(null);
    toast.success(`${MPA_NAME} ${old ? "updated" : "created"}. Tick, export or email it like any list.`);
  };
  const active = allLists.find((l) => l.id === activeId) || registry[0];
  const listCats = useListCategories(online);
  const menuLists = [INVENTORY_LIST, ...allLists.filter((l) => l !== INVENTORY_LIST)];
  const org = organiseLists(menuLists, listCats);
  const [crewHidden, showCrewLists] = useCrewHidden(boatId);
  const helpPanels = useAdminLists("Admin - Help Panel - ", online);
  const batchHelp = helpPanels.find((p) => p.name.toLowerCase().replace(/\s+/g, " ") === "admin - help panel - batch magic scan button")?.items;
  const hiddenLists = crew ? crewHidden : state.list_hidden || [];
  const showOwnerLists = (ids, show) => mutate((s) => ({ ...s, list_hidden: show ? (s.list_hidden || []).filter((id) => !ids.includes(id)) : [...new Set([...(s.list_hidden || []), ...ids])] }));
  const showLists = crew ? showCrewLists : showOwnerLists;
  const linkList = (id, category) => mutate((s) => ({ ...s, registry: s.registry.map((l) => (l.id === id ? { ...l, category } : l)) }));
  const pickList = (id) => {
    setActiveId(id);
    setDialog(null);
    setTimeout(() => document.querySelector('[data-testid="list-selector"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const listDescription = active.description || templates?.[active.id]?.description || "";
  const [ordering, setOrdering] = useListOrdering(active.id);
  const [folded, setFold, setFoldAll] = useFolds(active.id);
  const [promptDelete, setPromptDelete] = useListSetting("mbp_prompt_delete", active.id, true);
  const [hideArea, setHideArea] = useListSetting("mbp_hide_area", active.id, true);
  const isTips = active.id === TIPS_ID;
  const items = data[active.id] || [];
  const tagging = premium && !crew && areas.length > 0;
  const movable = tagging && !isTips && active.id !== FAQ_ID && !active.isMedia && !MEDIA_KINDS.includes(active.kind) && !active.isInventory;
  const areaName = (item) => areas.find((a) => a.id === item.area)?.name || null;
  const filterAreas = areas.filter((a) => items.some((i) => i.area === a.id));
  const shown = !areaFilter ? items : items.filter((i) => (areaFilter === NO_AREA ? !areaName(i) : i.area === areaFilter));
  useEffect(() => { setAreaFilter(""); }, [active.id]);
  const ctx = useMemo(() => ({ vessel: boat.vessel.trim(), callsign: boat.callsign.trim(), position: gps.text, verboseDate: VERBOSE_DATE, pob: boat.pob || 1, children: boat.children || 0, mmsi: boat.mmsi?.length === 9 ? boat.mmsi : "", boatType: (boat.boat_type || "").trim(), pets: boat.pets || [] }), [boat, gps.text, VERBOSE_DATE]);
  const labelFor = (item) => displayLabel(item, ctx);

  const ready = !!(boat.vessel.trim() && boat.skipper.trim() && boat.callsign.trim());
  const ownerOnly = (fn) => (...args) => (crew ? toast.info("On a shared boat, crew can tick items only") : fn(...args));
  const guard = (zone = "top") => {
    if (ready) return true;
    showWarn(zone);
    return false;
  };
  const setItems = (fn) => mutate((s) => ({ ...s, data: { ...s.data, [active.id]: fn(s.data[active.id] || []) } }));
  const isDup = (text, exceptId) => !mealLists.some((l) => l.id === active.id) && items.some((i) => i.id !== exceptId && i.label.toLowerCase() === text.toLowerCase());
  const signOffWalkthrough = async (stops) => {
    const when = new Date().toLocaleString("en-NZ", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    if (!crew) {
      const label = `Crew Walkthrough signed off by ${user.name || user.email} on ${when} (${stops} ${stops === 1 ? "stop" : "stops"})`;
      mutate((s) => ({ ...s, data: { ...s.data, shipsLog: [...(s.data.shipsLog || []), { id: Date.now(), label, checked: false }] } }));
      toast.success("Walkthrough signed off in the Ship's Log");
      return true;
    }
    if (!online) { toast.error("Signing off on a shared boat needs a signal"); return false; }
    try {
      await api.post("/me/boat/walkthrough-signoff", { when, stops }, { params: boatParams(boats.current), timeout: 10000 });
      toast.success("Walkthrough signed off in the skipper's Ship's Log");
      return true;
    } catch (e) { toast.error(apiError(e, "Couldn't sign off right now. Please try again.")); return false; }
  };

  const toggle = (id) => guard() && setItems((list) => list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const remove = (id) => {
    if (!guard()) return;
    const listId = active.id;
    const index = items.findIndex((i) => i.id === id);
    const item = items[index];
    if (!item) return;
    // removeOutline promotes the next sub-item when a group's main item goes; undo puts that back too.
    const promoted = !(index > 0 && item.indent) && items[index + 1]?.indent ? items[index + 1].id : null;
    setItems((list) => removeOutline(list, id));
    const undo = () => mutate((s) => {
      const cur = s.data[listId];
      if (!cur || cur.some((i) => i.id === id)) return s;
      const restored = cur.map((i) => (i.id === promoted ? { ...i, indent: true } : i));
      restored.splice(Math.min(index, restored.length), 0, item);
      return { ...s, data: { ...s.data, [listId]: restored } };
    });
    const name = labelFor(item);
    toast(`Deleted "${name.length > 40 ? `${name.slice(0, 40)}…` : name}"`, { duration: 6000, action: { label: "Undo", onClick: undo } });
  };
  // Category delete: removes the chosen ids; one Undo puts them all back in place.
  const removeMany = (ids) => {
    if (!guard()) return;
    const listId = active.id;
    const gone = items.map((item, index) => ({ item, index })).filter((x) => ids.includes(x.item.id));
    setItems((list) => list.filter((i) => !ids.includes(i.id)));
    const undo = () => mutate((s) => {
      const cur = s.data[listId];
      if (!cur || cur.some((i) => ids.includes(i.id))) return s;
      const restored = [...cur];
      gone.forEach(({ item, index }) => restored.splice(Math.min(index, restored.length), 0, item));
      return { ...s, data: { ...s.data, [listId]: restored } };
    });
    toast(`Deleted ${gone.length} item${gone.length === 1 ? "" : "s"}`, { duration: 6000, action: { label: "Undo", onClick: undo } });
  };
  const flag = (id) => guard() && setItems((list) => flagOutline(list, id));
  const move = (id, dir) => guard() && setItems((list) => moveOutline(list, id, dir));
  const indent = (id, v) => guard() && setItems((list) => setIndent(list, id, v));
  const askRemove = (id) => {
    if (!guard()) return;
    const i = items.findIndex((x) => x.id === id);
    const info = outlineInfo(items)[id];
    if (info?.subs) { setDialog({ type: "deleteGroup", group: { head: items[i], subs: items.slice(i + 1, i + 1 + info.subs) } }); return; }
    if (!promptDelete) { remove(id); return; }
    setDialog({ type: "deleteItem", item: items.find((i) => i.id === id) });
  };
  // Indenting a group's main item merges the whole group into the one above, so check first.
  const askIndent = (id, v) => {
    const info = outlineInfo(items);
    if (!v || !info[id]?.subs) { indent(id, v); return; }
    if (!guard()) return;
    const i = items.findIndex((x) => x.id === id);
    const parent = items.find((x) => x.id === info[items[i - 1].id].parent);
    setDialog({ type: "mergeGroup", id, name: labelFor(items[i]), subs: info[id].subs, parent: labelFor(parent) });
  };
  const logService = (key, listId) => (entry) => guard("service") && mutate((s) => ({
    ...s, [key]: [...(s[key] || []), { ...entry, items: (s.data[listId] || []).filter((i) => i.checked).map((i) => i.label) }],
    data: { ...s.data, [listId]: (s.data[listId] || []).map((i) => (i.checked ? { ...i, checked: false } : i)) },
  }));
  const place = (id, pos) => guard() && setItems((list) => placeOutline(list, id, pos));
  const setServiceDue = (listId, date) => {
    if (!registry.some((l) => l.id === "myTodo")) { toast.error("Bring back My To Do List with Reset All... to get service reminders"); return; }
    const id = `due_${listId}`;
    const label = `${listId === "engineService" ? "Engine" : "Electrical"} service due ${date ? date.split("-").reverse().join("/") : ""}`;
    if (!guard("due")) return;
    mutate((s) => {
      const rest = (s.data.myTodo || []).filter((i) => i.id !== id);
      return { ...s, data: { ...s.data, myTodo: date ? [...rest, { id, label, due: date, checked: false }] : rest } };
    });
    toast.success(date ? `Reminder added to My To Do List: ${label}` : "Reminder removed from My To Do List");
  };
  const [exporting, setExporting] = useState(false);
  const exportService = async (key) => {
    if (!needPro("Service History PDF")) return;
    if (!online) { toast.error("Connect to the internet to export the service history"); return; }
    const kind = key === "engine_log" ? "engine" : "electrical";
    setExporting(true);
    try {
      const { data } = await api.post("/service-history/pdf", { kind, vessel: boat.vessel, skipper: boat.skipper, callsign: boat.callsign,
        local_date: new Date().toLocaleDateString("en-NZ"), entries: (state[key] || []).map(({ id, ...e }) => e) }, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = Object.assign(document.createElement("a"), { href: url, download: `${kind === "engine" ? "Engine" : "Electrical"} Service History - ${boat.vessel || "My Boat"}.pdf` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { toast.error("Couldn't create the PDF. Please try again."); }
    setExporting(false);
  };
  const reset = ownerOnly((zone) => guard(zone) && setDialog({ type: "reset" }));
  const confirmReset = (ids) => {
    mutate((s) => resetLists(s, ids, templates));
    setDialog(null);
    toast.success(ids.length === 1 ? `${resetOptions(state, templates).find((o) => o.id === ids[0])?.name} reset` : `${ids.length} lists reset`);
  };
  const askDeleteList = () => {
    if (!guard()) return;
    if (registry.length <= 1) { toast.error("You need to keep at least one list"); return; }
    // A template list the admin has since retired is the skipper's own list now: Reset All can't bring it back.
    const retired = active.id.startsWith("tpl_") && !templateIds(templates).includes(active.id);
    setDialog({ type: "deleteList", list: { ...active, isSystem: active.isSystem && !retired } });
  };
  const deleteList = () => {
    const { id, isSystem } = dialog.list;
    const idx = registry.findIndex((l) => l.id === id);
    const next = registry[idx + 1] || registry[idx - 1];
    mutate((s) => {
      const data = { ...s.data };
      delete data[id];
      return { ...s, registry: s.registry.filter((l) => l.id !== id), data, list_hidden: (s.list_hidden || []).filter((h) => h !== id), deleted_lists: isSystem ? [...(s.deleted_lists || []), id] : s.deleted_lists || [] };
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
    if (active.id === "myTodo" && !premium && items.filter((i) => !String(i.id).startsWith("due_")).length >= FREE_TODO_LIMIT) {
      askUpgrade("More than 5 To Do items");
      return `The Free plan holds ${FREE_TODO_LIMIT} To Do items. Go Pro for unlimited.`;
    }
    setItems((list) => [...list, { id: Date.now(), label: text, checked: false }]);
    return true;
  };
  const saveEdit = (item) => (text) => {
    if (!text) return "Item text cannot be empty";
    if (isDup(text, item.id)) return `${text} already exists`;
    const mealHead = isMealHead(items, item.id);
    setItems((list) => list.map((i) => {
      if (i.id !== item.id) return i;
      const { dynamic, area, meal_type: mt, meal_type_auto: auto, ...rest } = i;
      const picked = mealHead && editMeal !== null;
      const meal = picked ? editMeal : mt;
      return { ...rest, label: text, ...(editArea ? { area: editArea } : {}), ...(meal ? { meal_type: meal, ...(auto && !picked ? { meal_type_auto: true } : {}) } : {}) };
    }));
    setDialog(null);
    return true;
  };
  const createList = (name, lines = [], autoIndent = false, description = "") => {
    if (!name) return "Please enter a list name";
    if (allLists.some((l) => l.name.toLowerCase() === name.toLowerCase())) return `${name} already exists`;
    const now = Date.now();
    const id = `custom_${now}`;
    const newItems = linesToItems(lines, autoIndent, now);
    mutate((s) => ({ ...s, registry: [...s.registry, { id, name, isSystem: false, ...(description ? { description: description.slice(0, DESCRIPTION_MAX) } : {}) }], data: { ...s.data, [id]: newItems } }));
    if (newItems.length) toast.success(`${name} created with ${newItems.length} ${newItems.length === 1 ? "item" : "items"}`);
    setActiveId(id);
    setDialog(null);
    return true;
  };
  const NO_CLONE = { myTodo: "My To Do List and Ship's Log cannot be cloned", shipsLog: "My To Do List and Ship's Log cannot be cloned",
    mayDay: "Mayday and Pan-Pan cannot be cloned", panPan: "Mayday and Pan-Pan cannot be cloned", boatInventory: "Boat Inventory cannot be cloned" };
  const askClone = () => {
    if (active.id === FAQ_ID) { toast.warning("FAQ is an admin list and cannot be cloned"); return; }
    if (NO_CLONE[active.id]) { toast.warning(NO_CLONE[active.id]); return; }
    if (needPro("Clone lists") && guard()) setDialog({ type: "clone", list: active });
  };
  const cloneSource = (source) => {
    if (source.isMedia) return { kind: source.kind, items: media[source.id].items.map(toOwnMedia) };
    if (source.id === TIPS_ID) return { kind: "tips", items: tips.map((t) => ({ id: t.id, label: t.label, checked: false })) };
    const own = state.data[source.id] || [];
    return { kind: source.kind, items: own.map((i) => (source.kind && source.kind !== "tips" ? { ...i, checked: false }
      : { id: i.id, label: i.label, checked: false, ...(i.indent ? { indent: true } : {}) })) };
  };
  const cloneList = (name) => {
    const source = dialog.list;
    if (!name) return "Please enter a list name";
    if (allLists.some((l) => l.name.toLowerCase() === name.toLowerCase())) return `${name} already exists`;
    const id = `custom_${Date.now()}`;
    const { kind, items: copied } = cloneSource(source);
    const cat = org.byId[source.id]?.cat;
    const category = cat >= 0 ? listCats[cat].name : null;
    mutate((s) => ({ ...s, registry: [...s.registry, { id, name, isSystem: false, ...(kind ? { kind } : {}), ...(category ? { category } : {}) }], data: { ...s.data, [id]: copied } }));
    setActiveId(id);
    setDialog(null);
    toast.success(`${name} created from ${source.name}`);
    return true;
  };
  const askRename = () => {
    if (active.isShared) { toast.warning("Skipper's Tips, Sailing YouTube Channels, Sailing Movies and FAQ are admin lists and cannot be renamed"); return; }
    if (active.isInventory) { toast.warning("Boat Inventory cannot be renamed"); return; }
    if (needPro("Rename lists") && guard()) setDialog({ type: "rename", list: { ...active, description: listDescription } });
  };
  const addTopUp = (picks) => {
    if (!guard()) return;
    setItems((cur) => insertSuggestions(cur, picks, Date.now(), labelFor));
    setDialog(null);
    toast.success(`${picks.length} ${picks.length === 1 ? "item" : "items"} added to ${active.name}`);
  };
  const renameList = (name, description = "", move = null) => {
    const { id, name: old } = dialog.list;
    if (!name) return "Please enter a list name";
    if (allLists.some((l) => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) return `${name} already exists`;
    if (move && !ready) return "Fill in your boat details at the top first, then you can move items to an area.";
    const descChanged = description !== (dialog.list.description || "");
    if (name !== old || descChanged) {
      mutate((s) => ({ ...s, registry: s.registry.map((l) => (l.id === id ? { ...l, name, ...(descChanged ? { description: description.slice(0, DESCRIPTION_MAX) } : {}) } : l)) }));
      toast.success(name !== old ? `${old} renamed to ${name}` : `${name} description saved`);
    }
    if (move) {
      setItems((list) => list.map((i) => (move.ids.includes(i.id) ? { ...i, area: move.area } : i)));
      toast.success(`${move.ids.length} ${move.ids.length === 1 ? "item" : "items"} moved to ${areas.find((a) => a.id === move.area)?.name}`);
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
      <Header gps={gps} online={online} pending={pending} onGoOffline={goOffline} onGoOnline={goOnline} tripDate={tripDate} onDateChange={setTripDate} onOpenFaq={openFaq}
        onMayday={() => openDistress("mayDay")} onPanPan={() => openDistress("panPan")} />
      <SyncBanner online={online} pending={pending} />
      <BoatSwitcher boats={boats} state={state} premium={premium} online={online} onUpgrade={() => askUpgrade("More than one boat")} onInviteUpgrade={() => askUpgrade("Crew sharing")} />
      {crew ? <><CrewBanner boat={boat} owner={boats.current.owner_name} /><CrewOrganiseButton onClick={() => setDialog({ type: "organise" })} /><VoyageCard boat={boats.current} online={online} /></>
        : <BoatDetails key={boatId} boat={boat} onChange={updateBoat} onBatchScan={startBatchScan} onOrganise={() => setDialog({ type: "organise" })} batchHelp={batchHelp} />}
      <ActionBar zone="top" warn={warn === "top" && !ready} onReset={() => reset("top")} onExport={(c) => exportLists(c, "top")} locked={!premium} />
      <ListSelector sections={dropdownSections(org, INVENTORY_LIST.id, hiddenLists, active.id)} activeColours={org.byId[active.id]?.colours} activeId={active.id} onChange={setActiveId} onCreate={ownerOnly(() => needPro("Create your own lists") && guard() && setDialog({ type: "list" }))} onClone={ownerOnly(askClone)} onRename={ownerOnly(askRename)} updatedIds={updatedIds} />
      {(!premium || (user.launch_free && !user.has_subscription && !user.is_admin)) && !crew && <First5000Banner variant="app" onUpgrade={() => askUpgrade("FIRST5000 launch offer")} />}
      <ListIntro key={`intro-${active.id}`} listId={active.id} canHide={premium} onLockedHide={() => askUpgrade("Hide help panels")}
        skipperChecked={state.emergency_checked?.[active.id]} onSkipperCheck={crew ? ownerOnly(() => {}) : (v) => mutate((s) => ({ ...s, emergency_checked: { ...(s.emergency_checked || {}), [active.id]: v } }))} />
      {listDescription && (
        <p className="whitespace-pre-line rounded-md border-l-4 border-[var(--navy)] bg-white px-3 py-2 text-sm text-[var(--muted)]" data-testid="list-description">
          {listDescription}
        </p>
      )}
      {!crew && updatedIds.includes(active.id) && (
        <TemplateUpdateNote key={`tpl-${active.id}`} listName={active.name} onGetLatest={getLatest}
          onKeepMine={() => mutate((s) => keepMine(s, active.id, templates))} />
      )}
      {!crew && active.id === "shipsLog" && (
        <EmailLogPanel email={boat.log_email || ""} shore={boat.shore_email || ""} onShoreChange={(v) => updateBoat("shore_email", v)}
          shoreOn={!!boat.shore_enabled} onShoreToggle={(v) => updateBoat("shore_enabled", v)} online={online} logSent={state.log_sent} busy={mail.sending}
          onSend={() => needPro("Email Ship's Log") && guard() && mail.requestSend(["shipsLog"], "Ship's Log")} locked={!premium} />
      )}
      {!crew && SERVICE_LOGS[active.id] && (
        <ServiceLogPanel key={active.id} kind={SERVICE_LOGS[active.id]} entries={state[SERVICE_LOGS[active.id]] || []} today={todayISO()}
          ticked={(state.data[active.id] || []).filter((i) => i.checked).map((i) => i.label)} warn={warn === "service" && !ready}
          onAdd={(entry) => logService(SERVICE_LOGS[active.id], active.id)(entry)}
          due={(state.data.myTodo || []).find((i) => i.id === `due_${active.id}`)} onSetDue={(d) => setServiceDue(active.id, d)} dueWarn={warn === "due" && !ready}
          onExport={() => exportService(SERVICE_LOGS[active.id])} locked={!premium} exporting={exporting} online={online} onUpgrade={() => askUpgrade("Magic Marine Engineer")}
          onDelete={(id) => guard() && mutate((s) => ({ ...s, [SERVICE_LOGS[active.id]]: (s[SERVICE_LOGS[active.id]] || []).filter((e) => e.id !== id) }))} />
      )}
      {isTips ? <TipsList tips={tips} admin={!!user.is_admin} online={online} onSave={saveTips} />
        : active.id === FAQ_ID ? <FaqList faq={faq} admin={!!user.is_admin} online={online} onSave={saveFaq} />
        : active.isMedia ? <MediaList key={active.id} list={active} store={media[active.id]} admin={!!user.is_admin} online={online} />
        : MEDIA_KINDS.includes(active.kind) ? <MediaList key={active.id} list={active} own={!crew} online={online} ordering={ordering} onOrderingChange={setOrdering} onDeleteList={askDeleteList}
            store={ownMediaStore(items, online, (fn) => guard() && setItems(fn))} />
        : active.isInventory ? (premium
          ? <InventoryList areas={areas} readOnly={crew} admin={!!user.is_admin && !crew} online={online} shared={inventoryShared.shared} onSharedChange={inventoryShared.update}
              onChange={(fn) => mutate((s) => ({ ...s, areas: fn(s.areas || []) }))}
              linked={linked} onMoveItems={(plan) => guard() && mutate((s) => applyMove(s, plan))}
              onToggleLinked={(l) => guard() && mutate((s) => ({ ...s, data: { ...s.data, [l.listId]: s.data[l.listId].map((i) => (i.id === l.item.id ? { ...i, checked: !i.checked } : i)) } }))}
              boat={boats.current} onBoatMaps={(maps) => boats.patch(boats.current.key, { zone_maps: maps })}
              batchRequest={batchRequest} onBatchHandled={() => setBatchRequest(false)} onSignOff={signOffWalkthrough} />
          : <InventoryLocked onUpgrade={() => askUpgrade("Boat inventory")} />) : (
        <>
          {premium && (tagging || filterAreas.length > 0) && !(hideArea && !crew) && (
            <AreaFilter areas={tagging ? areas : filterAreas} value={areaFilter} onChange={setAreaFilter} />
          )}
          {!areaFilter && <FoldAllButton items={items} folded={folded} onFoldAll={setFoldAll} />}
          {areaFilter && shown.length === 0 ? <p className="rounded-lg border-[1.5px] border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]" data-testid="area-filter-empty">No items in this area.</p> : (
          <Checklist items={shown} labelFor={labelFor} emergency={EMERGENCY[active.id]} tickOnly={crew} areaOf={premium ? areaName : undefined}
            onToggle={toggle} onDelete={askRemove} onEdit={(item) => { if (guard()) { setEditArea(item.area && areaName(item) ? item.area : ""); setEditMeal(null); setDialog({ type: "edit", item }); } }} onDeleteList={askDeleteList}
            ordering={ordering && !areaFilter} outline={!areaFilter} onFlag={flag} onMove={move} onPlace={place} onIndent={askIndent} folded={folded} onFold={setFold} />)}
          {!crew && ordering && areaFilter && <p className="text-sm font-semibold text-[var(--muted)]" data-testid="ordering-filter-note">Clear the area filter to reorder items.</p>}
          {!crew && <AddItemForm key={`add-${active.id}`} onAdd={addItem} ordering={ordering} onOrderingChange={setOrdering} promptDelete={promptDelete} onPromptDeleteChange={setPromptDelete}
            hideArea={hideArea} onHideAreaChange={premium && (tagging || filterAreas.length > 0) ? (v) => { setHideArea(v); if (v) setAreaFilter(""); } : undefined}
            placeholder={{ shipsLog: "My own Ship's Log...", myTodo: "Note a little issue to fix..." }[active.id] || (active.kind === "tips" ? "Add a Skipper's Tip..." : `My own ${active.name} task name...`)} />}
          {!crew && premium && !NO_TOPUP.includes(active.id) && <TopUpButton online={online} onClick={() => guard() && setDialog({ type: "topup" })} />}
          {!crew && active.id === "routeHazards" && (
            <NavigatorAsk key={boatId} boat={boat} gps={gps} onChange={updateBoat} items={items.map((i) => labelFor(i)).filter(Boolean)} online={online} locked={!premium} onUpgrade={() => askUpgrade("Magic Marine Navigator")} />
          )}
          {!crew && (active.id === "provisions" || active.kind === MPA_KIND || mealLists.some((l) => l.id === active.id)) && (
            <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={() => (premium ? guard() && setDialog({ type: "mpa" }) : askUpgrade("Marine Magic Provisioning"))} data-testid="mpa-open-btn">
              <Sparkles className="h-4 w-4 shrink-0" /> Marine Magic Provisioning Assistant
            </button>
          )}
          {/^first aid kit/i.test(active.name || "") && (
            <DoctorAsk key={active.id} kitName={active.name} kit={items.map((i) => labelFor(i)).filter(Boolean)} adults={(boat.pob || 1) - Math.min(boat.children || 0, (boat.pob || 1) - 1)}
              children={Math.min(boat.children || 0, (boat.pob || 1) - 1)} pets={(boat.pets || []).filter((p) => p.type?.trim() || p.name?.trim())} units={boat.units === "ft" ? "lb" : "kg"}
              online={online} locked={!premium} onUpgrade={() => askUpgrade("Magic Marine Doctor")} />
          )}
        </>
      )}
      {user.is_admin && !crew && templateIds(templates).includes(active.id) && (
        <PublishTemplateBar list={active} items={items} template={templates[active.id]} online={online} onPublish={publishTemplate} />
      )}
      <ActionBar zone="bottom" warn={warn === "bottom" && !ready} onReset={() => reset("bottom")} onExport={(c) => exportLists(c, "bottom")} locked={!premium} />
      {!premium && <AdBanner online={online} onRemoveAds={() => askUpgrade("Removing ads")} />}
      <CreateListDialog open={dialog?.type === "list"} online={online} onConfirm={createList} onClose={() => setDialog(null)} />
      <OrganiseDialog open={dialog?.type === "organise"} onClose={() => setDialog(null)} org={org} cats={listCats} lists={menuLists} hidden={hiddenLists}
        crew={crew} admin={!!user.is_admin} onPick={pickList} onShow={showLists} onLink={linkList} />
      <TextDialog open={dialog?.type === "clone"} title="Clone List" confirmLabel="Clone" testId="clone-list"
        description={dialog?.type === "clone" ? `Make a separate copy of ${dialog.list.name}${dialog.list.isMedia || MEDIA_KINDS.includes(dialog.list.kind) ? " that you can add to, edit and reorder." : ", with every item unticked."}` : ""}
        initial={dialog?.type === "clone" ? `My ${dialog.list.name}` : ""}
        onConfirm={dialog?.type === "clone" ? cloneList : () => true} onClose={() => setDialog(null)} />
      <RenameListDialog list={dialog?.type === "rename" ? dialog.list : null} onConfirm={renameList} onClose={() => setDialog(null)}
        areas={movable && dialog?.list?.id === active.id ? areas : []} items={items} labelFor={labelFor} areaOf={areaName} />
      <TopUpDialog open={dialog?.type === "topup"} list={active} items={items} description={listDescription} labelFor={labelFor} onAdd={addTopUp} onClose={() => setDialog(null)} />
      <MpaDialog open={dialog?.type === "mpa"} lists={mealLists} boat={boat} areas={areas} provisions={provisionNames} online={online} onClose={() => setDialog(null)} onCreate={saveMpa} />
      <TextDialog open={dialog?.type === "edit"} title="Edit Item" confirmLabel="Save" testId="edit-item" maxLength={ITEM_MAX}
        initial={dialog?.type === "edit" ? labelFor(dialog.item) : ""}
        onConfirm={dialog?.type === "edit" ? saveEdit(dialog.item) : () => true} onClose={() => setDialog(null)}>
        {tagging && <AreaPicker areas={areas} value={editArea} onChange={setEditArea} />}
        {dialog?.type === "edit" && isMealHead(items, dialog.item.id) && <MealTypePicker value={editMeal ?? dialog.item.meal_type ?? ""} onChange={setEditMeal} />}
      </TextDialog>
      <ResetListsDialog open={dialog?.type === "reset"} options={resetOptions(state, templates)} onConfirm={confirmReset} onClose={() => setDialog(null)} />
      <DeleteListDialog list={dialog?.type === "deleteList" ? dialog.list : null} onConfirm={deleteList} onClose={() => setDialog(null)} />
      <ConfirmDelete item={dialog?.type === "deleteItem" ? { name: labelFor(dialog.item) } : null} testId="item-delete"
        note={dialog?.type === "deleteItem" ? `It will be removed from ${active.name}.` : ""}
        onConfirm={() => { remove(dialog.item.id); setDialog(null); }} onClose={() => setDialog(null)} />
      <DeleteGroupDialog group={dialog?.type === "deleteGroup" ? dialog.group : null} labelFor={labelFor}
        onConfirm={(ids) => { removeMany(ids); setDialog(null); }} onClose={() => setDialog(null)} />
      <ConfirmDelete item={dialog?.type === "mergeGroup" ? dialog : null} testId="merge-group" danger={false} confirmLabel="Move into group" cancelLabel="Cancel"
        title={dialog?.type === "mergeGroup" ? `Move "${dialog.name}" into the group above?` : ""}
        note={dialog?.type === "mergeGroup" ? `"${dialog.name}" and its ${dialog.subs} sub-item${dialog.subs === 1 ? "" : "s"} will become sub-items of "${dialog.parent}". Its group will no longer show on its own. To get it back, unindent "${dialog.name}".` : ""}
        onConfirm={() => { indent(dialog.id, true); setDialog(null); }} onClose={() => setDialog(null)} />
      {emailPrompt}
    </main>
  );
}
