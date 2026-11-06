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
import { DEFAULT_DATA, addTemplateLists, displayLabel, isOutdated, keepMine, resetLists, resetOptions, templateIds, templateItems } from "@/lib/defaults";
import { MergeDialog } from "@/components/boat/merge/MergeDialog";
import { DepartureCheck } from "@/components/boat/departure/DepartureCheck";
import { ITEM_PHOTO_LISTS } from "@/components/boat/ItemPhoto";
import { SLOTS } from "@/components/boat/PhotoSlots";

const servicePhotos = (items) => items.flatMap((i) => SLOTS.filter((s) => i[s.id]).map((s) => ({ item: i.label, slot: s.label, photo_id: i[s.id], note: i[s.note] || "" }))).slice(0, 60);
import { ArrivalCheck } from "@/components/boat/departure/ArrivalCheck";
import { BoatSwitcher } from "@/components/boat/BoatSwitcher";
import { TemplateUpdateNote } from "@/components/boat/TemplateUpdateNote";
import { CrewBanner } from "@/components/boat/CrewBanner";
import { CrewAgreement } from "@/components/boat/agreement/CrewAgreement";
import { RoleBriefingField } from "@/components/boat/agreement/RoleBriefingField";
import { CrewPrepCloneDialog } from "@/components/boat/CrewPrepCloneDialog";
import { CrewPrepProgress, crewPrepName } from "@/components/boat/CrewPrepProgress";
import { HullSpeedHint } from "@/components/boat/telemetry/HullSpeedHint";
import { WeatherPhotos, weatherUrl } from "@/components/boat/navigator/WeatherPhotos";
import { DepartureLogDialog, departureDecision } from "@/components/boat/navigator/DepartureLogDialog";
import { VoyageCard } from "@/components/boat/VoyageCard";
import { GoDecisionCard } from "@/components/boat/GoDecisionCard";
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
import { CREW_ROLES, crewRolesList, INVITE_DRAFT, roleBriefings, roleGroups } from "@/lib/crewRoles";
import { BackToInviteBar } from "@/components/boat/BackToInviteBar";
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
import { WeightsContext } from "@/components/boat/weights/WeightsContext";
import { CrewDietContext, dietText, useOnBoardCrew } from "@/lib/crewDiet";
import { DietBanner } from "@/components/boat/register/DietBanner";
import { WalkthroughPrompt } from "@/components/boat/register/WalkthroughPrompt";
import { weighUp } from "@/lib/weights";
import useLogFolders from "@/components/boat/shipslog/useLogFolders";
import { ShipsLogPanel } from "@/components/boat/shipslog/ShipsLogPanel";
import { ExpandAllButton } from "@/components/boat/shipslog/ClampText";
import { PrintView } from "@/components/boat/PrintView";
import { EmailLogPanel } from "@/components/boat/EmailLogPanel";
import { ServiceLogPanel } from "@/components/boat/ServiceLogPanel";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { DeleteGroupDialog } from "@/components/boat/DeleteGroupDialog";
import { MealTypePicker } from "@/components/boat/MealTypePicker";
import { DESCRIPTION_MAX } from "@/components/boat/ListDraftTools";
import { FoldAllButton } from "@/components/boat/FoldAllButton";
import { First5000Banner } from "@/components/boat/First5000Banner";
import { ITEM_MAX, departureTicked, flagOutline, insertSuggestions, levelShifts, linesToItems, moveOutline, moveToPath, normalizeLevels, outlineInfo, placeOutline, removeOutline, restoreLevels, setIndent, tickDeparture } from "@/lib/outline";
import { DeleteListDialog } from "@/components/boat/DeleteListDialog";
import { ResetListsDialog } from "@/components/boat/ResetListsDialog";
import { BudgetList } from "@/components/boat/budget/BudgetList";
import { MaintList } from "@/components/boat/maint/MaintList";
import { ExcelExportDialog } from "@/components/boat/ExcelExportDialog";
import { ShopScanDialog } from "@/components/boat/stores/ShopScanDialog";
import { bulkMove, canTakeItems } from "@/lib/bulkMove";
import { SyncStoresDialog } from "@/components/boat/stores/SyncStoresDialog";
import { applyConsumed, applyShopping, applyTargets, shopLog, usedLog } from "@/lib/stores";
import { boatRows, crewRows, inventoryRows, listRows, serviceRows, zoneRows } from "@/lib/excelExport";
import { MaintSetupDialog } from "@/components/boat/maint/MaintSetupDialog";
import { ImportDialog } from "@/components/boat/import/ImportDialog";
import { MoveItemDialog } from "@/components/boat/import/MoveItemDialog";
import { moveInto, movedRow } from "@/lib/sheetImport";
import { CustomListBuilder } from "@/components/boat/maint/CustomListBuilder";
import { CUSTOM, DUE_KEY, MAINT_CATEGORY, MAINT_KIND, MAINT_LISTS, MAINT_PREFIX, attrsForList, maintItems, masterDefs, offerKey, withInheritedDue, withService } from "@/lib/maint";
import { BUDGET_ID, BUDGET_KIND, BUDGET_PREFIX, budgetCurrency, hasBudget, withBudget } from "@/lib/budget";
import { BartenderDialog } from "@/components/boat/bartender/BartenderDialog";
import { CocktailList } from "@/components/boat/bartender/CocktailList";
import { SundownerCard } from "@/components/boat/bartender/SundownerCard";
import { BARTENDER_KIND, BARTENDER_NAME, cocktailItems } from "@/lib/bartender";

const SERVICE_LOGS = { engineService: "engine_log", electricalService: "electrical_log", riggingChecks: "rigging_log" };
const SERVICE_META = {
  engine_log: { kind: "engine", list: "engineService", title: "Engine", who: (e) => `${e.hours} hrs${e.engine_type ? ` (${e.engine_type})` : ""}` },
  electrical_log: { kind: "electrical", list: "electricalService", title: "Electrical", who: (e) => `by ${e.electrician}` },
  rigging_log: { kind: "rigging", list: "riggingChecks", title: "Rigging", who: (e) => `by ${e.rigger}` },
};
// Every logged service also goes in the Ship's Log.
const serviceLogLine = (key, e, items) => {
  const m = SERVICE_META[key];
  return `${m.title} service logged: ${m.who(e)} on ${e.date.split("-").reverse().join("/")}${items.length ? ` - ${items.join(", ")}` : ""}${e.notes ? ` - Notes: ${e.notes}` : ""}`.slice(0, 2000);
};
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
  const onBoard = useOnBoardCrew(boats.current.boat_id, online, !crew);
  const diet = useMemo(() => (onBoard ? { ...onBoard, text: dietText(onBoard.people) } : null), [onBoard]);
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
  const [editBriefing, setEditBriefing] = useState("");
  const { boat, registry } = state;
  const missingTemplates = loaded && !crew && !!addTemplateLists(state, templates);
  useEffect(() => { if (missingTemplates) mutate((s) => addTemplateLists(s, templates) || s); }, [missingTemplates, templates, mutate]);
  const budgetTpl = useAdminLists(BUDGET_PREFIX, online)[0];
  const needBudget = loaded && !crew && !!budgetTpl && !hasBudget(state) && !(state.deleted_lists || []).includes(BUDGET_ID);
  useEffect(() => {
    if (needBudget) mutate((s) => withBudget(s, budgetTpl.items), { count: false });
  }, [needBudget]); // eslint-disable-line react-hooks/exhaustive-deps
  const maintDefs = masterDefs(useAdminLists(MAINT_PREFIX, online));
  const haveMaint = MAINT_LISTS.filter((m) => registry.some((l) => l.kind === MAINT_KIND && l.maint === m.key)).map((m) => m.key);
  const OFFERS = "mbp_maint_offers";
  const offered = () => { try { return JSON.parse(localStorage.getItem(OFFERS)) || []; } catch { return []; } };
  const offerMaint = () => {
    if (crew || haveMaint.length || !["make", "model", "boat_type"].every((k) => (boat[k] || "").trim()) || offered().includes(offerKey(boatId, boat))) return;
    setTimeout(() => setDialog({ type: "maint", auto: true }), 250);
  };
  const dismissMaint = () => { localStorage.setItem(OFFERS, JSON.stringify([...offered(), offerKey(boatId, boat)].slice(-50))); setDialog(null); };
  const importLists = (built) => {
    const now = Date.now();
    const add = built.map((b, n) => ({ id: `maint_${CUSTOM}_${now + n}`, name: b.name, isSystem: false, kind: MAINT_KIND, maint: CUSTOM, imported: true, attrs: b.defs, columns: b.defs.slice(0, 2).map((d) => d.key) }));
    mutate((s) => ({ ...s, registry: [...s.registry, ...add], data: { ...s.data, ...Object.fromEntries(add.map((l, n) => [l.id, built[n].items])) } }));
    setDialog(null);
    pickList(add[0].id);
    toast.success(`${add.length} ${add.length === 1 ? "list" : "lists"} imported: ${add.map((l) => l.name).join(", ")}`.slice(0, 300));
  };
  const moveImported = (item, toId) => {
    const target = registry.find((l) => l.id === toId);
    const from = active.id;
    const before = { [from]: data[from] || [], [toId]: data[toId] || [] };
    const id = Math.max(Date.now(), ...before[toId].map((i) => Number(i.id) || 0)) + 1;
    const row = movedRow(item, attrsForList(maintDefs, active), target, id, target.kind === MAINT_KIND ? attrsForList(maintDefs, target) : []);
    mutate((s) => ({ ...s, data: { ...s.data, [from]: (s.data[from] || []).filter((i) => i.id !== item.id), [toId]: moveInto(s.data[toId] || [], row, target) } }));
    setDialog(null);
    toast(`Moved "${item.label}" to ${target.name}`, { duration: 6000, action: { label: "Undo", onClick: () => mutate((s) => ({ ...s, data: { ...s.data, ...before } })) } });
  };
  const bulkMoveItems = ({ to, ids }) => {
    const target = registry.find((l) => l.id === to);
    const from = active.id;
    const before = { [from]: data[from] || [], [to]: data[to] || [] };
    // Built from the latest state so an area move in the same Save is kept.
    mutate((s) => {
      const moved = bulkMove({ source: active, sourceItems: s.data[from] || [], target, targetItems: s.data[to] || [], ids, labelFor,
        defs: active.kind === MAINT_KIND ? attrsForList(maintDefs, active) : [], targetDefs: target.kind === MAINT_KIND ? attrsForList(maintDefs, target) : [] });
      return { ...s, data: { ...s.data, [from]: moved.source, [to]: moved.target } };
    });
    toast(`${ids.length} ${ids.length === 1 ? "item" : "items"} moved to ${target.name}`, { duration: 6000, action: { label: "Undo", onClick: () => mutate((s) => ({ ...s, data: { ...s.data, ...before } })) } });
  };
  const createCustom = ({ name, attrs, columns }) => {
    const id = `maint_${CUSTOM}_${Date.now()}`;
    mutate((s) => ({ ...s, registry: [...s.registry, { id, name, isSystem: false, kind: MAINT_KIND, maint: CUSTOM, attrs, columns }],
      data: { ...s.data, [id]: [{ id: Date.now(), label: "Items", checked: false, maint: true, attrs: {} }] } }));
    setDialog(null);
    pickList(id);
    toast.success(`${name} created. Add your items under Items, or add your own categories.`);
  };
  const createMaint = (made, due) => {
    const now = Date.now();
    const taken = new Set(registry.map((l) => l.name.toLowerCase()));
    const add = made.map((m, n) => ({ id: `maint_${m.key}_${now + n}`, name: taken.has(m.name.toLowerCase()) ? `My ${m.name}` : m.name, isSystem: false, kind: MAINT_KIND, maint: m.key, category: MAINT_CATEGORY }));
    mutate((s) => ({ ...s, registry: [...s.registry, ...add], data: { ...s.data, ...Object.fromEntries(add.map((l, n) => [l.id, maintItems(made[n].groups, due, now + n * 1000)])) } }));
    setDialog(null);
    pickList(add[0].id);
    toast.success(`${add.length} Boat Maintenance ${add.length === 1 ? "list" : "lists"} created. Review and correct each one.`);
  };
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
  // Ship's Log rows open to their full text one by one or all at once; they start at 3 lines each visit.
  const [logOpen, setLogOpen] = useState([]);
  useEffect(() => { setLogOpen([]); }, [active.id]);
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
  const ctx = useMemo(() => ({ vessel: boat.vessel.trim(), callsign: boat.callsign.trim(), position: gps.text, verboseDate: VERBOSE_DATE, pob: boat.pob || 1, children: boat.children || 0, mmsi: boat.mmsi?.length === 9 ? boat.mmsi : "", boatType: (boat.boat_type || "").trim(), pets: boat.pets || [], currency: budgetCurrency(boat), yearBuilt: boat.year_built }), [boat, gps.text, VERBOSE_DATE]);
  const labelFor = (item) => displayLabel(item, ctx);

  const ready = !!(boat.vessel.trim() && boat.skipper.trim() && boat.callsign.trim());
  const ownerOnly = (fn) => (...args) => (crew ? toast.info("On a shared boat, crew can tick items only") : fn(...args));
  const guard = (zone = "top") => {
    if (ready) return true;
    showWarn(zone);
    return false;
  };
  const setItems = (fn) => mutate((s) => ({ ...s, data: { ...s.data, [active.id]: fn(s.data[active.id] || []) } }));
  // The same item can sit under different groups (e.g. a wind check under each departure type); duplicates only clash within one group or at the top level.
  const parentOf = (list, k) => { if (k <= 0 || !list[k]?.indent) return null; for (let j = k - 1; j >= 0; j -= 1) if (!list[j].indent) return list[j].id; return null; };
  const isDup = (text, exceptId) => {
    if (mealLists.some((l) => l.id === active.id)) return false;
    const at = items.findIndex((i) => i.id === exceptId);
    const scope = at >= 0 ? parentOf(items, at) : null;
    return items.some((i, k) => i.id !== exceptId && i.label.toLowerCase() === text.toLowerCase() && parentOf(items, k) === scope);
  };
  const logMmd = (item) => {
    if (crew) { toast.success("Question and answer logged in the skipper's Ship's Log"); return; }
    mutate((s) => ({ ...s, data: { ...s.data, shipsLog: [...(s.data.shipsLog || []), item] } }));
    toast.success("Question and answer logged in the Ship's Log");
  };
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

  const toggle = (id) => {
    if (!guard()) return;
    if (active.id !== "leavingDock") { setItems((list) => list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))); return; }
    const next = tickDeparture(items, id);
    setItems((list) => tickDeparture(list, id));
    if (!crew && !departureTicked(items) && departureTicked(next)) setDialog({ type: "departLog" });
  };
  // Select All: ticks (or clears) every row shown; single rows can still be unticked afterwards.
  const tickAll = (on) => {
    if (!guard()) return;
    const ids = new Set(shown.map((i) => i.id));
    const next = items.map((i) => (ids.has(i.id) ? { ...i, checked: on } : i));
    const before = new Map(items.filter((i) => ids.has(i.id)).map((i) => [i.id, !!i.checked]));
    setItems((list) => list.map((i) => (ids.has(i.id) ? { ...i, checked: on } : i)));
    toast(on ? `Ticked all ${ids.size} items` : `Unticked all ${ids.size} items`, { duration: 6000, action: { label: "Undo", onClick: () => setItems((list) => list.map((i) => (before.has(i.id) ? { ...i, checked: before.get(i.id) } : i))) } });
    if (active.id === "leavingDock" && !crew && !departureTicked(items) && departureTicked(next)) setDialog({ type: "departLog" });
  };
  const remove = (id) => {
    if (!guard()) return;
    const listId = active.id;
    const index = items.findIndex((i) => i.id === id);
    const item = items[index];
    if (!item) return;
    // removeOutline promotes the first sub-item when an item with sub-items goes; undo puts their levels back too.
    const shifted = levelShifts(items, removeOutline(items, id));
    setItems((list) => removeOutline(list, id));
    const undo = () => mutate((s) => {
      const cur = s.data[listId];
      if (!cur || cur.some((i) => i.id === id)) return s;
      const restored = restoreLevels(cur, shifted);
      restored.splice(Math.min(index, restored.length), 0, item);
      return { ...s, data: { ...s.data, [listId]: restored } };
    });
    const name = item.cocktail || item.budget ? item.label || "item" : labelFor(item);
    toast(`Deleted "${name.length > 40 ? `${name.slice(0, 40)}…` : name}"`, { duration: 6000, action: { label: "Undo", onClick: undo } });
  };
  // Category delete: removes the chosen ids; one Undo puts them all back in place.
  const removeMany = (ids) => {
    if (!guard()) return;
    const listId = active.id;
    const gone = items.map((item, index) => ({ item, index })).filter((x) => ids.includes(x.item.id));
    const shifted = levelShifts(items, normalizeLevels(items.filter((i) => !ids.includes(i.id))));
    setItems((list) => normalizeLevels(list.filter((i) => !ids.includes(i.id))));
    const undo = () => mutate((s) => {
      const cur = s.data[listId];
      if (!cur || cur.some((i) => ids.includes(i.id))) return s;
      const restored = restoreLevels(cur, shifted);
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
    const all = outlineInfo(items);
    const info = all[id];
    if (info?.subs) {
      const subs = items.slice(i + 1, i + 1 + info.subs);
      setDialog({ type: "deleteGroup", group: { head: items[i], subs, depth: Object.fromEntries(subs.map((s) => [s.id, all[s.id].depth - info.depth])) } });
      return;
    }
    if (!promptDelete) { remove(id); return; }
    setDialog({ type: "deleteItem", item: items.find((i) => i.id === id) });
  };
  // Indenting a group's main item merges the whole group into the one above, so check first.
  const logService = (key, listId) => (entry) => guard("service") && mutate((s) => {
    const done = (s.data[listId] || []).filter((i) => i.checked).map((i) => i.label);
    const line = { id: Date.now() + 1, label: serviceLogLine(key, entry, done), checked: false };
    return {
      ...s, [key]: [...(s[key] || []), { ...entry, items: done }],
      data: { ...s.data, [listId]: (s.data[listId] || []).map((i) => (i.checked ? { ...i, checked: false } : i)), shipsLog: [...(s.data.shipsLog || []), line] },
    };
  });
  const place = (id, pos) => guard() && setItems((list) => placeOutline(list, id, pos));
  const placePath = (id, path) => {
    if (!guard()) return;
    const res = moveToPath(items, id, path);
    if (res.error) { toast.error(`Can't move it to ${path}: ${res.error}`); return; }
    const parent = path.split(".").slice(0, -1).join(".");
    const info = outlineInfo(items);
    const p = parent && items.find((x) => info[x.id]?.num === parent);
    if (p) [...info[p.id].ancestors, p.id].forEach((a) => setFold(a, false));
    setItems((list) => moveToPath(list, id, path).items || list);
    const num = outlineInfo(res.items)[id]?.num;
    if (num && num !== path) toast(`Moved - it's now ${num}, because the numbers above it shifted`);
  };
  // Log Rigging Check / Log Service from a Boat Maintenance list: item dates + history, Rigging Service History, Ship's Log and a To Do reminder.
  const logMaintService = (entry) => {
    if (!guard()) return false;
    const listId = active.id;
    const name = active.name;
    const labels = items.filter((i) => entry.ids.includes(i.id)).map((i) => i.label);
    const dmy = (iso) => iso.split("-").reverse().join("/");
    const after = withService(items, entry);
    const dues = after.map((i) => i.attrs?.[DUE_KEY]).filter(Boolean).sort();
    const remind = entry.due && registry.some((l) => l.id === "myTodo");
    const todoId = `due_maint_${listId}`;
    mutate((s) => {
      const log = { id: Date.now(), date: entry.date, rigger: entry.by, notes: entry.notes, items: labels, list: name, ...(entry.due ? { due: entry.due } : {}) };
      const line = { id: Date.now() + 1, label: `${name}: ${serviceLogLine("rigging_log", log, labels)}${entry.due ? ` - Next due ${dmy(entry.due)}` : ""}`.slice(0, 2000), checked: false };
      const todo = (s.data.myTodo || []).filter((i) => i.id !== todoId);
      return {
        ...s, rigging_log: [...(s.rigging_log || []), log],
        data: { ...s.data, [listId]: withService(s.data[listId] || [], entry), shipsLog: [...(s.data.shipsLog || []), line],
          ...(remind ? { myTodo: [...todo, { id: todoId, label: `${name} service due ${dmy(dues[0])}`, due: dues[0], checked: false }] } : {}) },
      };
    });
    toast.success(`Logged for ${labels.length} ${labels.length === 1 ? "item" : "items"} in the Rigging Service History${remind ? ", reminder in My To Do List" : ""}`);
    if (entry.due && !remind) toast.info("Bring back My To Do List with Reset All... to get service reminders");
    return true;
  };
  const setServiceDue = (listId, date) => {
    if (!registry.some((l) => l.id === "myTodo")) { toast.error("Bring back My To Do List with Reset All... to get service reminders"); return; }
    const id = `due_${listId}`;
    const label = `${{ engineService: "Engine service", electricalService: "Electrical service", riggingChecks: "Rigging check" }[listId]} due ${date ? date.split("-").reverse().join("/") : ""}`;
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
    const { kind, list, title } = SERVICE_META[key];
    setExporting(true);
    try {
      const { data } = await api.post("/service-history/pdf", { kind, vessel: boat.vessel, skipper: boat.skipper, callsign: boat.callsign,
        local_date: new Date().toLocaleDateString("en-NZ"), entries: (state[key] || []).map(({ id, ...e }) => e),
        boat_id: boats.current.boat_id, photos: servicePhotos(state.data[list] || []) }, { responseType: "blob", timeout: 90000 });
      const url = URL.createObjectURL(data);
      const a = Object.assign(document.createElement("a"), { href: url, download: `${title} Service History - ${boat.vessel || "My Boat"}.pdf` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { toast.error("Couldn't create the PDF. Please try again."); }
    setExporting(false);
  };
  const reset = ownerOnly((zone) => guard(zone) && setDialog({ type: "reset" }));
  const confirmReset = (ids) => {
    const rest = ids.filter((id) => id !== BUDGET_ID);
    mutate((s) => {
      const next = rest.length ? resetLists(s, rest, templates) : s;
      return ids.includes(BUDGET_ID) ? withBudget(next, budgetTpl?.items || []) : next;
    });
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
      return { ...s, registry: s.registry.filter((l) => l.id !== id), data, list_hidden: (s.list_hidden || []).filter((h) => h !== id), deleted_lists: isSystem || id === BUDGET_ID ? [...(s.deleted_lists || []), id] : s.deleted_lists || [] };
    });
    setActiveId(next.id);
    setDialog(null);
    toast.success(`${dialog.list.name} deleted`);
  };
  const openStores = (type) => {
    if (!needPro(type === "shopScan" ? "Batch Magic Scan My Shopping" : "Sync Food & Drink Boat Areas")) return;
    if (!online) { toast.error("The Magic Provisioning Assistant needs a signal"); return; }
    setDialog({ type });
  };
  const areaLabel = (id) => areas.find((a) => a.id === id)?.name || "Boat area";
  const logStores = (label) => ({ id: Date.now(), label: label.slice(0, 2000), checked: false });
  const doneShopping = (rows) => {
    const entry = logStores(shopLog(rows.map((r) => ({ ...r, areaName: areaLabel(r.dest) })), (r) => r.areaName, boat.units));
    mutate((s) => ({ ...s, areas: applyShopping(s.areas || [], rows), data: { ...s.data, shipsLog: [...(s.data.shipsLog || []), entry] } }));
    setDialog(null);
    toast.success(`${rows.reduce((n, r) => n + r.qty, 0)} items put away and written in the Ship's Log`);
  };
  const doneUsed = (rows) => {
    const entry = logStores(usedLog(rows, (r) => areaLabel(r.areaId), boat.units));
    mutate((s) => ({ ...s, areas: applyConsumed(s.areas || [], rows), data: { ...s.data, shipsLog: [...(s.data.shipsLog || []), entry] } }));
    setDialog(null);
    toast.success(`${rows.reduce((n, r) => n + r.qty, 0)} items taken out of your stores and written in the Ship's Log`);
  };
  const buildSheets = async (all) => {
    const sctx = { currency: budgetCurrency(boat), yearBuilt: boat.year_built, labelFor, areaName, maintDefs: (l) => attrsForList(maintDefs, l) };
    const sheet = (l) => ({ name: l.name, rows: l.isInventory ? inventoryRows(areas, boats.current) : listRows(l, data[l.id] || [], sctx) });
    if (!all) return [sheet(active)];
    const out = [{ name: "Boat details", rows: boatRows(boat) }, ...registry.map(sheet), { name: "Boat inventory", rows: inventoryRows(areas, boats.current) },
      { name: "Engine service history", rows: serviceRows(state.engine_log || [], "engine_log") },
      { name: "Electrical service history", rows: serviceRows(state.electrical_log || [], "electrical_log") },
      { name: "Rigging service history", rows: serviceRows(state.rigging_log || [], "rigging_log") },
      { name: "Zone maps", rows: zoneRows(boats.current, areas) }];
    if (crew) return out;
    const info = online ? await api.get(`/boats/${boats.current.boat_id}/crew`, { timeout: 20000 }).then((r) => r.data).catch(() => null) : null;
    return [...out, { name: "Crew", rows: info ? crewRows(info) : [{ Note: "The crew list needs a signal. Export again when you're online to include it." }] }];
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
  // Roles (not the group headings) in the Crew Roles list carry a Role Briefing.
  const isRoleItem = (item) => {
    const k = items.findIndex((i) => i.id === item.id);
    return CREW_ROLES.test(active.name.trim()) && !(k >= 0 && !items[k].indent && items[k + 1]?.indent);
  };
  const saveEdit = (item) => (text) => {
    if (!text) return "Item text cannot be empty";
    if (isDup(text, item.id)) return `${text} already exists`;
    const mealHead = isMealHead(items, item.id);
    const briefing = isRoleItem(item) ? editBriefing.trim() : item.briefing;
    setItems((list) => list.map((i) => {
      if (i.id !== item.id) return i;
      const { dynamic, area, meal_type: mt, meal_type_auto: auto, briefing: _b, ...rest } = i;
      const picked = mealHead && editMeal !== null;
      const meal = picked ? editMeal : mt;
      return { ...rest, label: text, ...(editArea ? { area: editArea } : {}), ...(meal ? { meal_type: meal, ...(auto && !picked ? { meal_type_auto: true } : {}) } : {}), ...(briefing ? { briefing } : {}) };
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
  // Magic Mariner builds "First Aid Kit - Pets" sized to the pets; an existing kit list gets its items replaced after asking.
  const showMpa = !crew && (active.id === "provisions" || active.kind === MPA_KIND || mealLists.some((l) => l.id === active.id));
  const [backToInvite, setBackToInvite] = useState(false);
  useEffect(() => {
    const openRoles = () => {
      const list = crewRolesList(state);
      if (!list) { toast.error("This boat has no Crew Roles list. Add one to choose the roles offered to crew."); window.dispatchEvent(new Event("mbp:open-invite")); return; }
      setActiveId(list.id);
      setBackToInvite(true);
      setTimeout(() => document.querySelector('[data-testid="list-selector"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    };
    window.addEventListener("mbp:crew-roles", openRoles);
    return () => window.removeEventListener("mbp:crew-roles", openRoles);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const openMpa = () => (premium ? guard() && setDialog({ type: "mpa" }) : askUpgrade("Magic Provisioning Assistant"));
  const openBartender = () => needPro("Magic Bartender") && guard() && setDialog({ type: "bartender" });
  const flagArea = (id, key) => mutate((s) => ({ ...s, areas: (s.areas || []).map((a) => (a.id === id ? { ...a, [key]: !a[key] } : a)) }));
  const kids = Math.min(boat.children || 0, (boat.pob || 1) - 1);
  const barList = registry.find((l) => l.kind === BARTENDER_KIND);
  const addProvisions = (names) => {
    if (!registry.some((l) => l.id === "provisions")) { toast.error("Bring back the Provisions list with Reset All... first"); return false; }
    if (!guard()) return false;
    const now = Date.now();
    mutate((s) => ({ ...s, data: { ...s.data, provisions: [...(s.data.provisions || []), ...names.map((n, k) => ({ id: now + k, label: n, checked: false }))] } }));
    toast.success(`${names.length} ${names.length === 1 ? "ingredient" : "ingredients"} added to Provisions`);
    return true;
  };
  const saveCocktails = (cocktails) => {
    const now = Date.now();
    const old = registry.find((l) => l.kind === BARTENDER_KIND);
    const id = old?.id || `custom_${now}`;
    mutate((s) => ({ ...s, registry: old ? s.registry : [...s.registry, { id, name: BARTENDER_NAME, isSystem: false, kind: BARTENDER_KIND }],
      data: { ...s.data, [id]: cocktailItems(cocktails, now) } }));
    setActiveId(id);
    setDialog(null);
    toast.success(`${BARTENDER_NAME} ${old ? "updated" : "created"} with ${cocktails.length} ${cocktails.length === 1 ? "cocktail" : "cocktails"}. Cheers!`);
  };
  const PET_KIT = "First Aid Kit - Pets";
  const makePetKit = async () => {
    if (!needPro("Pet First Aid Kit")) return false;
    if (!online) { toast.error("The Magic Mariner needs a signal to make the Pet First Aid Kit"); return false; }
    const existing = allLists.find((l) => l.name.toLowerCase() === PET_KIT.toLowerCase());
    if (existing && !window.confirm(`Replace the items in ${PET_KIT} with a new kit for your pets?`)) return false;
    try {
      const pets = (boat.pets || []).filter((p) => p.type?.trim() || p.name?.trim()).map(({ type, name, breed, weight }) => ({ type, name, breed, weight }));
      const { data } = await api.post("/ai/pet-kit", { pets, units: boat.units === "ft" ? "lb" : "kg", days: boat.trip_days || 0 }, { timeout: 120000 });
      if (!existing) return createList(PET_KIT, data.lines, true, data.description) === true;
      const now = Date.now();
      mutate((s) => ({ ...s, data: { ...s.data, [existing.id]: linesToItems(data.lines, true, now) } }));
      setActiveId(existing.id);
      toast.success(`${PET_KIT} updated for your pets`);
      return true;
    } catch (e) {
      toast.error(apiError(e, "The Magic Mariner couldn't make the Pet First Aid Kit right now. Please try again."));
      return false;
    }
  };
  const NO_CLONE = { myTodo: "My To Do List and Ship's Log cannot be cloned", shipsLog: "My To Do List and Ship's Log cannot be cloned",
    mayDay: "Mayday and Pan-Pan cannot be cloned", panPan: "Mayday and Pan-Pan cannot be cloned", boatInventory: "Boat Inventory cannot be cloned" };
  const askClone = () => {
    if (active.id === FAQ_ID) { toast.warning("FAQ is an admin list and cannot be cloned"); return; }
    if (NO_CLONE[active.id]) { toast.warning(NO_CLONE[active.id]); return; }
    if (needPro("Clone lists") && guard()) setDialog({ type: active.id === "crewPrep" ? "crewClone" : "clone", list: active });
  };
  const cloneSource = (source) => {
    if (source.isMedia) return { kind: source.kind, items: media[source.id].items.map(toOwnMedia) };
    if (source.id === TIPS_ID) return { kind: "tips", items: tips.map((t) => ({ id: t.id, label: t.label, checked: false })) };
    const own = state.data[source.id] || [];
    return { kind: source.kind, items: own.map((i) => (source.kind && source.kind !== "tips" ? { ...i, checked: false }
      : { id: i.id, label: i.label, checked: false, ...(i.indent ? { indent: true } : {}), ...(i.level ? { level: i.level } : {}) })) };
  };
  const listExists = (name) => allLists.some((l) => l.name.toLowerCase() === name.toLowerCase());
  const cloneMany = (source, names) => {
    const fresh = [...new Set(names)].filter((n) => !listExists(n));
    if (!fresh.length) return false;
    const { kind, items: copied } = cloneSource(source);
    const cat = org.byId[source.id]?.cat;
    const category = cat >= 0 ? listCats[cat].name : null;
    const stampNow = Date.now();
    const made = fresh.map((name, n) => ({ id: `custom_${stampNow}${n ? `_${n}` : ""}`, name, isSystem: false, ...(kind ? { kind } : {}), ...(category ? { category } : {}) }));
    mutate((s) => ({ ...s, registry: [...s.registry, ...made], data: { ...s.data, ...Object.fromEntries(made.map((l) => [l.id, copied.map((i) => ({ ...i }))])) } }));
    setActiveId(made[made.length - 1].id);
    setDialog(null);
    toast.success(fresh.length === 1 ? `${fresh[0]} created from ${source.name}` : `${fresh.join(", ")} created from ${source.name}`);
    return true;
  };
  const cloneList = (name) => {
    if (!name) return "Please enter a list name";
    if (listExists(name)) return `${name} already exists`;
    cloneMany(dialog.list, [name]);
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
  const renameList = (name, description = "", move = null, bulk = null) => {
    const { id, name: old } = dialog.list;
    if (!name) return "Please enter a list name";
    if (allLists.some((l) => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) return `${name} already exists`;
    if ((move || bulk) && !ready) return "Fill in your boat details at the top first, then you can move items.";
    const descChanged = description !== (dialog.list.description || "");
    if (name !== old || descChanged) {
      mutate((s) => ({ ...s, registry: s.registry.map((l) => (l.id === id ? { ...l, name, ...(descChanged ? { description: description.slice(0, DESCRIPTION_MAX) } : {}) } : l)) }));
      toast.success(name !== old ? `${old} renamed to ${name}` : `${name} description saved`);
    }
    if (move) {
      setItems((list) => list.map((i) => (move.ids.includes(i.id) ? { ...i, area: move.area } : i)));
      toast.success(`${move.ids.length} ${move.ids.length === 1 ? "item" : "items"} moved to ${areas.find((a) => a.id === move.area)?.name}`);
    }
    if (bulk) bulkMoveItems(bulk);
    setDialog(null);
    return true;
  };
  const takeMaster = () => {
    if (!guard()) return;
    mutate((s) => resetLists(s, [active.id], templates));
    setDialog(null);
    toast.success(`${active.name} now has the latest master items`);
  };
  const keepMineOnly = () => {
    mutate((s) => keepMine(s, active.id, templates));
    setDialog(null);
  };
  const mergeLatest = (merged, n) => {
    if (!guard()) return;
    mutate((s) => ({ ...keepMine(s, active.id, templates), data: { ...s.data, [active.id]: merged } }));
    setDialog(null);
    toast.success(n ? `${n} master ${n === 1 ? "change" : "changes"} merged into ${active.name}` : `Kept your ${active.name} as it is`);
  };
  const publishTemplate = async (id, list, note) => {
    const res = await publish(id, list, note);
    mutate((s) => ({ ...s, template_versions: { ...(s.template_versions || {}), [id]: res.updated_at } }));
    return res;
  };
  const openFaq = () => {
    setActiveId(FAQ_ID);
    setTimeout(() => document.querySelector('[data-testid="list-selector"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const updateBoat = (key, value) => mutate((s) => ({ ...s, boat: { ...s.boat, [key]: value } }), { count: false });
  const patchWeather = (patch) => mutate((s) => ({ ...s, boat: { ...s.boat, weather: { ...(s.boat.weather || {}), ...patch } } }), { count: false });
  const logDecision = () => {
    const entry = departureDecision(boat);
    mutate((s) => ({ ...s, data: { ...s.data, shipsLog: [...(s.data.shipsLog || []), entry] },
      boat: { ...s.boat, weather: { ...(s.boat.weather || {}), photos: (s.boat.weather?.photos || []).map((p) => ({ ...p, logged: true })) } } }));
    setDialog(null);
    toast.success("Departure decision logged in the Ship's Log");
  };
  const engineType = [...(state.engine_log || [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).find((e) => e.engine_type)?.engine_type || "";
  const logDeparture = (text, kind) => {
    const id = Date.now();
    mutate((s) => ({ ...s, data: { ...s.data, shipsLog: [...(s.data.shipsLog || []), { id, label: text.slice(0, 2000), checked: false }] } }));
    toast.success(`${kind} status copied to the Ship's Log`);
    return id;
  };
  const itemPhotos = {
    boatId: boats.current.boat_id, owner: crew ? boats.current.owner_id : "", listId: active.id, canEdit: !crew, online,
    onPatch: (id, patch) => mutate((s) => ({ ...s, data: { ...s.data, [active.id]: (s.data[active.id] || []).map((i) => (i.id === id ? { ...i, ...patch } : i)) } })),
  };
  const logTank = (text) => {
    if (!guard()) return false;
    mutate((s) => ({ ...s, data: { ...s.data, shipsLog: [...(s.data.shipsLog || []), { id: Date.now(), label: text.slice(0, 2000), checked: false }] } }));
    toast.success("Logged in the Ship's Log");
    return true;
  };
  const relogDeparture = (id, text, kind) => {
    mutate((s) => ({ ...s, data: { ...s.data, shipsLog: (s.data.shipsLog || []).map((i) => (i.id === id ? { ...i, label: text.slice(0, 2000) } : i)) } }));
    toast.success(`Ship's Log ${kind.toLowerCase()} entry updated`);
  };
  const unlogDeparture = (id) => mutate((s) => ({ ...s, data: { ...s.data, shipsLog: (s.data.shipsLog || []).filter((i) => i.id !== id) } }));
  const mail = useEmailSender({ savedEmail: boat.log_email, saveEmail: (v) => updateBoat("log_email", v), emailLog, localDate: VERBOSE_DATE, position: gps.text });
  const emailPrompt = (
    <TextDialog open={!!mail.prompt} title="Where should we send it?" description="Enter the email address for your PDFs. It's saved next to Skipper for next time."
      inputType="email" placeholder="you@email.com" confirmLabel="Send" testId="email-prompt" initial={mail.prompt?.initial || ""}
      onConfirm={mail.confirmEmail} onClose={mail.closePrompt} />
  );

  const logOn = active.id === "shipsLog" && !areaFilter;
  const logFolders = useLogFolders({ items: shown, setItems, guard, crew, onEdit: (item) => { if (guard()) setDialog({ type: "edit", item }); } });
  if (printMode) {
    const lists = printMode === "current" ? [active] : registry;
    const title = printMode === "current" ? active.name : "Vessel Manifest Master Logs";
    const ids = lists.map((l) => l.id);
    return (
      <>
        <PrintView lists={lists} data={withInheritedDue(data, registry)} labelFor={labelFor} boat={boat} verboseDate={VERBOSE_DATE} title={title} onBack={() => setPrintMode(null)}
          onEmail={ownerOnly(() => needPro("Email PDF") && mail.requestSend(ids, title))} online={online} sending={mail.sending}
          emailed={mail.sentKey === ids.join(",")} locked={!premium} />
        {emailPrompt}
      </>
    );
  }

  const helpNamed = (n) => helpPanels.find((p) => p.name.toLowerCase().replace(/\s+/g, " ").trim() === n)?.items;
  const weights = weighUp({ boat, registry, data: state.data, defs: maintDefs, areas, engineType, crewWeights: (onBoard?.people || []).map((p) => p.weight_kg) });
  return (
    <WeightsContext.Provider value={weights}>
    <CrewDietContext.Provider value={diet}>
    <main className="relative mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-5" data-testid="boat-prep-app">
      <BoatWatermark boat={boats.current} />
      <Header gps={gps} online={online} pending={pending} onGoOffline={goOffline} onGoOnline={goOnline} tripDate={tripDate} onDateChange={setTripDate} onOpenFaq={openFaq} onBartender={crew ? undefined : openBartender}
        onShopScan={crew ? undefined : () => openStores("shopScan")} onSyncStores={crew ? undefined : () => openStores("syncStores")}
        onBuilder={crew ? undefined : () => guard() && setDialog({ type: "builder" })}
        onImport={crew ? undefined : () => guard() && setDialog({ type: "import" })}
        onMayday={() => openDistress("mayDay")} onPanPan={() => openDistress("panPan")} />
      <SyncBanner online={online} pending={pending} />
      <BoatSwitcher boats={boats} state={state} premium={premium} online={online} onUpgrade={() => askUpgrade("More than one boat")} onInviteUpgrade={() => askUpgrade("Crew sharing")} />
      {crew ? <><CrewBanner boat={boat} owner={boats.current.owner_name} /><CrewAgreement boat={boats.current} vessel={boat.vessel || "this boat"} areas={areas} online={online} />
        <WalkthroughPrompt boat={boats.current} vessel={boat.vessel || "this boat"} areas={areas} online={online} onSignOff={signOffWalkthrough} onOpenArea={() => setActiveId(INVENTORY_LIST.id)} /><CrewOrganiseButton onClick={() => setDialog({ type: "organise" })} /><VoyageCard boat={boats.current} online={online} /><GoDecisionCard boat={boats.current} online={online} /></>
        : <BoatDetails key={boatId} boat={boat} onChange={updateBoat} onBatchScan={startBatchScan} onOrganise={() => setDialog({ type: "organise" })} batchHelp={batchHelp} onMakeKit={makePetKit}
            onDetailsClosed={offerMaint} onMaintSetup={crew || haveMaint.length === MAINT_LISTS.length ? undefined : () => setTimeout(() => setDialog({ type: "maint", auto: false }), 250)} />}
      {barList && <SundownerCard items={state.data[barList.id] || []} vessel={boat.vessel} gps={gps} kids={kids} onOpen={() => pickList(barList.id)} />}
      <ActionBar zone="top" warn={warn === "top" && !ready} onReset={() => reset("top")} onExport={(c) => exportLists(c, "top")} onExcel={() => setDialog({ type: "excel" })} locked={!premium} />
      <ListSelector sections={dropdownSections(org, INVENTORY_LIST.id, hiddenLists, active.id)} activeColours={org.byId[active.id]?.colours} activeId={active.id} onChange={setActiveId} onCreate={ownerOnly(() => needPro("Create your own lists") && guard() && setDialog({ type: "list" }))} onClone={ownerOnly(askClone)} onRename={ownerOnly(askRename)} updatedIds={updatedIds} />
      {(!premium || (user.launch_free && !user.has_subscription && !user.is_admin)) && !crew && <First5000Banner variant="app" onUpgrade={() => askUpgrade("FIRST5000 launch offer")} />}
      <ListIntro key={`intro-${active.id}`} listId={active.id} helpItems={active.id === "shipsLog" ? helpNamed("admin - help panel - ships log") : undefined} canHide={premium} onLockedHide={() => askUpgrade("Hide help panels")}
        skipperChecked={state.emergency_checked?.[active.id]} onSkipperCheck={crew ? ownerOnly(() => {}) : (v) => mutate((s) => ({ ...s, emergency_checked: { ...(s.emergency_checked || {}), [active.id]: v } }))} />
      {listDescription && (
        <p className="whitespace-pre-line rounded-md border-l-4 border-[var(--navy)] bg-white px-3 py-2 text-sm text-[var(--muted)]" data-testid="list-description">
          {listDescription}
        </p>
      )}
      {!crew && updatedIds.includes(active.id) && (
        <TemplateUpdateNote key={`tpl-${active.id}`} listName={active.name} onMerge={() => guard() && setDialog({ type: "merge" })}
          onKeepMine={keepMineOnly} />
      )}
      {!crew && active.id === "shipsLog" && (
        <EmailLogPanel email={boat.log_email || ""} shore={boat.shore_email || ""} onShoreChange={(v) => updateBoat("shore_email", v)}
          shoreOn={!!boat.shore_enabled} onShoreToggle={(v) => updateBoat("shore_enabled", v)} online={online} logSent={state.log_sent} busy={mail.sending}
          onSend={() => needPro("Email Ship's Log") && guard() && mail.requestSend(["shipsLog"], "Ship's Log")} locked={!premium} />
      )}
      {!crew && active.id === "leavingDock" && (
        <DepartureCheck boat={boat} onBoatChange={updateBoat} engineType={engineType} premium={premium} online={online}
          onUpgrade={() => askUpgrade("Magic Mariner passage calculation")} onLog={logDeparture} onUnlog={unlogDeparture} onRelog={relogDeparture} onTankLog={logTank} />
      )}
      {!crew && (active.id === "arrivingDest" || active.id === "returningDock") && (
        <ArrivalCheck boat={boat} listName={active.name} engineType={engineType} onBoatChange={updateBoat} onLog={logDeparture} onUnlog={unlogDeparture} onRelog={relogDeparture} onTankLog={logTank} />
      )}
      {!crew && SERVICE_LOGS[active.id] && (
        <ServiceLogPanel key={active.id} kind={SERVICE_LOGS[active.id]} entries={state[SERVICE_LOGS[active.id]] || []} today={todayISO()}
          ticked={(state.data[active.id] || []).filter((i) => i.checked).map((i) => i.label)} warn={warn === "service" && !ready}
          onAdd={(entry) => logService(SERVICE_LOGS[active.id], active.id)(entry)}
          due={(state.data.myTodo || []).find((i) => i.id === `due_${active.id}`)} onSetDue={(d) => setServiceDue(active.id, d)} dueWarn={warn === "due" && !ready}
          onExport={() => exportService(SERVICE_LOGS[active.id])} locked={!premium} exporting={exporting} online={online} onUpgrade={() => askUpgrade("Magic Marine Engineer")}
          cruise={boat.cruise_kn} onCruise={(v) => updateBoat("cruise_kn", v)} cruiseHint={<HullSpeedHint boat={boat} onUse={(v) => updateBoat("cruise_kn", v)} testId="engine-hull-speed" />}
          onDelete={(id) => guard() && mutate((s) => ({ ...s, [SERVICE_LOGS[active.id]]: (s[SERVICE_LOGS[active.id]] || []).filter((e) => e.id !== id) }))} />
      )}
      {isTips ? <TipsList tips={tips} admin={!!user.is_admin} online={online} onSave={saveTips} />
        : active.id === FAQ_ID ? <FaqList faq={faq} admin={!!user.is_admin} online={online} onSave={saveFaq} />
        : active.isMedia ? <MediaList key={active.id} list={active} store={media[active.id]} admin={!!user.is_admin} online={online} />
        : MEDIA_KINDS.includes(active.kind) ? <MediaList key={active.id} list={active} own={!crew} online={online} ordering={ordering} onOrderingChange={setOrdering} onDeleteList={askDeleteList}
            store={ownMediaStore(items, online, (fn) => guard() && setItems(fn))} />
        : active.isInventory ? (premium
          ? <InventoryList areas={areas} vessel={boat.vessel} readOnly={crew} admin={!!user.is_admin && !crew} online={online} shared={inventoryShared.shared} onSharedChange={inventoryShared.update}
              onChange={(fn) => mutate((s) => ({ ...s, areas: fn(s.areas || []) }))}
              linked={linked} onMoveItems={(plan) => guard() && mutate((s) => applyMove(s, plan))}
              onToggleLinked={(l) => guard() && mutate((s) => ({ ...s, data: { ...s.data, [l.listId]: s.data[l.listId].map((i) => (i.id === l.item.id ? { ...i, checked: !i.checked } : i)) } }))}
              boat={boats.current} onBoatMaps={(maps) => boats.patch(boats.current.key, { zone_maps: maps })}
              batchRequest={batchRequest} onBatchHandled={() => setBatchRequest(false)} onSignOff={signOffWalkthrough} />
          : <InventoryLocked onUpgrade={() => askUpgrade("Boat inventory")} />)
        : active.kind === BUDGET_KIND && !crew ? <BudgetList key={active.id} items={items} setItems={setItems} boat={boat} onBoatChange={updateBoat} premium={premium} online={online}
            onUpgrade={() => askUpgrade("Magic Mariner budgeting comments")} guard={guard} onDeleteList={askDeleteList} />
        : active.kind === MAINT_KIND ? <MaintList key={active.id} list={active} items={items} setItems={setItems} defs={attrsForList(maintDefs, active)} guard={guard} onDeleteList={askDeleteList}
            onLogService={logMaintService}
            ordering={ordering} onOrderingChange={setOrdering} promptDelete={promptDelete} onPromptDeleteChange={setPromptDelete}
            ctx={{ units: boat.units, yearBuilt: boat.year_built, currency: budgetCurrency(boat), boatId: boats.current.boat_id, owner: crew ? boats.current.owner_id : null, listId: active.id, online, readOnly: crew, onMove: active.imported && !crew ? (item) => setDialog({ type: "moveItem", item }) : undefined }} />
        : active.kind === BARTENDER_KIND ? <CocktailList items={items} readOnly={crew} onToggle={toggle} onDelete={remove} onRemix={openBartender} provisions={provisionNames} onAddProvisions={addProvisions} /> : (
        <>
          {crewPrepName(active.name) && <CrewPrepProgress name={crewPrepName(active.name)} items={items} />}
          {premium && (tagging || filterAreas.length > 0) && !(hideArea && !crew) && (
            <AreaFilter areas={tagging ? areas : filterAreas} value={areaFilter} onChange={setAreaFilter} />
          )}
          {!areaFilter && (
            <div className="flex flex-wrap items-center justify-end gap-2" data-testid="list-top-tools">
              {showMpa && (
                <button type="button" className="btn-solid h-10 gap-1.5 px-3 text-sm" onClick={openMpa} title="Magic Provisioning Assistant" data-testid="mpa-open-top-btn">
                  <Sparkles className="h-4 w-4 shrink-0" /> Magic Provisioning Assistant
                </button>
              )}
              <FoldAllButton items={items} folded={folded} onFoldAll={setFoldAll} />
            </div>
          )}
          {showMpa && <DietBanner />}
          {logOn && !crew && <ShipsLogPanel items={items} setItems={setItems} labelFor={labelFor} boat={boat} boatId={boats.current.boat_id} guard={guard} online={online} needPro={needPro}
            help={helpNamed("admin - help panel - ships log passage folders")} folders={logFolders} />}
          {active.id === "shipsLog" && shown.length > 0 && (
            <ExpandAllButton anyOpen={logOpen.length > 0} onAll={(on) => setLogOpen(on ? (logOn ? logFolders.visible : shown).filter((i) => !i.folder).map((i) => i.id) : [])} />
          )}
          {areaFilter && shown.length === 0 ? <p className="rounded-lg border-[1.5px] border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]" data-testid="area-filter-empty">No items in this area.</p> : (
          <Checklist items={logOn ? logFolders.visible : shown} depthOf={logOn ? logFolders.depthOf : undefined} folderRow={logOn ? logFolders.folderRow : undefined} labelFor={labelFor} logPhotoUrl={active.id === "shipsLog" ? weatherUrl(boats.current.boat_id, crew ? boats.current.owner_id : null) : undefined} emergency={EMERGENCY[active.id]} tickOnly={crew} photos={ITEM_PHOTO_LISTS.includes(active.id) ? itemPhotos : null} areaOf={premium ? areaName : undefined} picks={CREW_ROLES.test(active.name.trim())}
            onToggle={toggle} onTickAll={crew || active.id === "shipsLog" || EMERGENCY[active.id] || /crew roles/i.test(active.name) ? undefined : tickAll} onDelete={askRemove} onEdit={(item) => { if (guard()) { setEditArea(item.area && areaName(item) ? item.area : ""); setEditMeal(null); setEditBriefing(item.briefing || ""); setDialog({ type: "edit", item }); } }} onDeleteList={askDeleteList}
            ordering={ordering && !areaFilter} outline={!areaFilter} onFlag={flag} onMove={move} onPlace={place} onPlacePath={placePath} onIndent={indent} folded={folded} onFold={setFold}
            clamp={active.id === "shipsLog" ? { open: logOpen, toggle: (id) => setLogOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])) } : null} />)}
          {!crew && ordering && areaFilter && <p className="text-sm font-semibold text-[var(--muted)]" data-testid="ordering-filter-note">Clear the area filter to reorder items.</p>}
          {backToInvite && CREW_ROLES.test(active.name.trim()) && (
            <BackToInviteBar onBack={() => { setBackToInvite(false); window.dispatchEvent(new Event("mbp:open-invite")); }}
              onDismiss={() => { setBackToInvite(false); sessionStorage.removeItem(INVITE_DRAFT); }} />
          )}
          {!crew && <AddItemForm key={`add-${active.id}`} onAdd={addItem} ordering={ordering} onOrderingChange={setOrdering} promptDelete={promptDelete} onPromptDeleteChange={setPromptDelete}
            hideArea={hideArea} onHideAreaChange={premium && (tagging || filterAreas.length > 0) ? (v) => { setHideArea(v); if (v) setAreaFilter(""); } : undefined}
            placeholder={{ shipsLog: "My own Ship's Log...", myTodo: "Note a little issue to fix..." }[active.id] || (active.kind === "tips" ? "Add a Skipper's Tip..." : `My own ${active.name} task name...`)} />}
          {!crew && premium && !NO_TOPUP.includes(active.id) && <TopUpButton online={online} onClick={() => guard() && setDialog({ type: "topup" })} />}
          {!crew && active.id === "routeHazards" && (
            <NavigatorAsk key={boatId} boat={boat} onChange={updateBoat} onWeather={patchWeather} boatId={boats.current.boat_id} items={items.map((i) => labelFor(i)).filter(Boolean)} online={online} locked={!premium} onUpgrade={() => askUpgrade("Magic Marine Navigator")} />
          )}
          {crew && active.id === "routeHazards" && <WeatherPhotos boat={boat} readOnly boatId={boats.current.boat_id} owner={boats.current.owner_id} online={online} />}
          {showMpa && (
            <button type="button" className="btn-solid h-12 justify-center gap-2" onClick={openMpa} data-testid="mpa-open-btn">
              <Sparkles className="h-4 w-4 shrink-0" /> Magic Provisioning Assistant
            </button>
          )}
          {/^first aid kit/i.test(active.name || "") && (
            <DoctorAsk key={active.id} kitName={active.name} kit={items.map((i) => labelFor(i)).filter(Boolean)} adults={(boat.pob || 1) - Math.min(boat.children || 0, (boat.pob || 1) - 1)}
              children={Math.min(boat.children || 0, (boat.pob || 1) - 1)} pets={(boat.pets || []).filter((p) => p.type?.trim() || p.name?.trim())} units={boat.units === "ft" ? "lb" : "kg"}
              online={online} locked={!premium} onUpgrade={() => askUpgrade("Magic Marine Doctor")}
              logParams={{ boat_id: boats.current.boat_id, owner_id: crew ? boats.current.owner_id : null }} crew={crew} onLogged={logMmd} />
          )}
        </>
      )}
      {user.is_admin && !crew && templateIds(templates).includes(active.id) && (
        <PublishTemplateBar list={active} items={items} template={templates[active.id]} online={online} onPublish={publishTemplate} />
      )}
      <ActionBar zone="bottom" warn={warn === "bottom" && !ready} onReset={() => reset("bottom")} onExport={(c) => exportLists(c, "bottom")} onExcel={() => setDialog({ type: "excel" })} locked={!premium} />
      {!premium && <AdBanner online={online} onRemoveAds={() => askUpgrade("Removing ads")} />}
      <CreateListDialog open={dialog?.type === "list"} online={online} onConfirm={createList} onClose={() => setDialog(null)} />
      <OrganiseDialog open={dialog?.type === "organise"} onClose={() => setDialog(null)} org={org} cats={listCats} lists={menuLists} hidden={hiddenLists}
        crew={crew} admin={!!user.is_admin} onPick={pickList} onShow={showLists} onLink={linkList} />
      <TextDialog open={dialog?.type === "clone"} title="Clone List" confirmLabel="Clone" testId="clone-list"
        description={dialog?.type === "clone" ? `Make a separate copy of ${dialog.list.name}${dialog.list.isMedia || MEDIA_KINDS.includes(dialog.list.kind) ? " that you can add to, edit and reorder." : ", with every item unticked."}` : ""}
        initial={dialog?.type === "clone" ? `My ${dialog.list.name}` : ""}
        onConfirm={dialog?.type === "clone" ? cloneList : () => true} onClose={() => setDialog(null)} />
      <RenameListDialog list={dialog?.type === "rename" ? dialog.list : null} onConfirm={renameList} onClose={() => setDialog(null)}
        areas={movable && dialog?.list?.id === active.id ? areas : []} items={items} labelFor={labelFor} areaOf={areaName}
        targets={!crew && dialog?.list?.id === active.id && registry.some((l) => l.id === active.id) ? registry.filter((l) => l.id !== active.id && !hiddenLists.includes(l.id) && canTakeItems(l)) : []} />
      <TopUpDialog open={dialog?.type === "topup"} list={active} items={items} description={listDescription} labelFor={labelFor} onAdd={addTopUp} onClose={() => setDialog(null)} />
      {dialog?.type === "merge" && <MergeDialog open list={active} local={items} master={templateItems(active.id, templates)} masterAt={templates?.[active.id]?.updated_at}
        syncedAt={state.template_versions?.[active.id]} fallbackBase={DEFAULT_DATA[active.id] || null} masterNote={templates?.[active.id]?.note || ""} online={online}
        onMerge={mergeLatest} onTakeMaster={takeMaster} onKeepMine={() => { keepMineOnly(); toast.success(`Kept your ${active.name}. The master updates were set aside`); }} onClose={() => setDialog(null)} />}
      {dialog?.type === "shopScan" && <ShopScanDialog boatId={boats.current.boat_id} areas={areas} units={boat.units} onDone={doneShopping} onClose={() => setDialog(null)}
        onApplyTargets={(t) => mutate((s) => ({ ...s, areas: applyTargets(s.areas || [], t) }))} />}
      {dialog?.type === "syncStores" && <SyncStoresDialog areas={areas} units={boat.units} onDone={doneUsed} onClose={() => setDialog(null)} />}
      {dialog?.type === "excel" && <ExcelExportDialog open listName={active.name} title={boat.vessel.trim() || "My Boat Prep"} buildSheets={buildSheets} onClose={() => setDialog(null)} />}
      {dialog?.type === "import" && <ImportDialog names={registry.map((l) => l.name)} ctx={{ units: boat.units, currency: budgetCurrency(boat) }} onImport={importLists} onClose={() => setDialog(null)} />}
      {dialog?.type === "moveItem" && <MoveItemDialog item={dialog.item} lists={registry.filter((l) => l.id !== active.id && !hiddenLists.includes(l.id))} onMove={(to) => moveImported(dialog.item, to)} onClose={() => setDialog(null)} />}
      {dialog?.type === "builder" && <CustomListBuilder master={maintDefs.filter((d, n, a) => a.findIndex((x) => x.key === d.key) === n)} names={registry.map((l) => l.name)}
        onCreate={createCustom} onClose={() => setDialog(null)} />}
      {dialog?.type === "maint" && <MaintSetupDialog boat={boat} premium={premium} online={online} defs={maintDefs} auto={dialog.auto} have={haveMaint}
        onCreate={createMaint} onDismiss={dismissMaint} onClose={() => setDialog(null)} />}
      {dialog?.type === "bartender" && <BartenderDialog open boatId={boats.current.boat_id} areas={areas} kids={kids} online={online} onFlag={flagArea}
        onBatchScan={() => { setDialog(null); startBatchScan(); }} onCreate={saveCocktails} onClose={() => setDialog(null)} />}
      <MpaDialog open={dialog?.type === "mpa"} activeId={active.id} lists={mealLists} boat={boat} areas={areas} provisions={provisionNames} online={online} onClose={() => setDialog(null)} onCreate={saveMpa} />
      <TextDialog open={dialog?.type === "edit"} title="Edit Item" confirmLabel="Save" testId="edit-item" maxLength={ITEM_MAX}
        initial={dialog?.type === "edit" ? labelFor(dialog.item) : ""}
        onConfirm={dialog?.type === "edit" ? saveEdit(dialog.item) : () => true} onClose={() => setDialog(null)}>
        {tagging && <AreaPicker areas={areas} value={editArea} onChange={setEditArea} />}
        {dialog?.type === "edit" && isMealHead(items, dialog.item.id) && <MealTypePicker value={editMeal ?? dialog.item.meal_type ?? ""} onChange={setEditMeal} />}
        {dialog?.type === "edit" && isRoleItem(dialog.item) && <RoleBriefingField value={editBriefing} onChange={setEditBriefing} />}
      </TextDialog>
      <DepartureLogDialog open={dialog?.type === "departLog"} boat={boat} boatId={boats.current.boat_id} onLog={logDecision} onClose={() => setDialog(null)} />
      {dialog?.type === "crewClone" && <CrewPrepCloneDialog boat={boats.current} vessel={boat.vessel || "your boat"} roleGroups={roleGroups(state)} briefings={roleBriefings(state)} online={online} premium={premium}
        onUpgrade={() => askUpgrade("Crew sharing")} listName={dialog.list.name} exists={listExists} onClone={(names) => cloneMany(dialog.list, names)} onClose={() => setDialog(null)} />}
      <ResetListsDialog open={dialog?.type === "reset"} options={resetOptions(state, templates)} onConfirm={confirmReset} onClose={() => setDialog(null)} />
      <DeleteListDialog list={dialog?.type === "deleteList" ? dialog.list : null} onConfirm={deleteList} onClose={() => setDialog(null)} />
      <ConfirmDelete item={dialog?.type === "deleteItem" ? { name: labelFor(dialog.item) } : null} testId="item-delete"
        note={dialog?.type === "deleteItem" ? `It will be removed from ${active.name}.` : ""}
        onConfirm={() => { remove(dialog.item.id); setDialog(null); }} onClose={() => setDialog(null)} />
      <DeleteGroupDialog group={dialog?.type === "deleteGroup" ? dialog.group : null} labelFor={labelFor} onHeadOnly={(id) => { remove(id); setDialog(null); }}
        onConfirm={(ids) => { removeMany(ids); setDialog(null); }} onClose={() => setDialog(null)} />
      {emailPrompt}
    </main>
    </CrewDietContext.Provider>
    </WeightsContext.Provider>
  );
}
