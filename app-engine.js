let isOnline = true; let outboxQueueCount = 0; let verboseDateString = "";
let listRegistry = [
  { id: "leavingDock", name: "Leaving Dock", isSystem: true }, { id: "returningDock", name: "Returning to Dock", isSystem: true },
  { id: "arrivingDest", name: "Arriving at Destination", isSystem: true }, { id: "safety", name: "Safety", isSystem: true },
  { id: "routeHazards", name: "Route Hazards", isSystem: true }, { id: "crewPrep", name: "Crew Prep", isSystem: true },
  { id: "provisions", name: "Provisions", isSystem: true }, { id: "shipsLog", name: "Ship log", isSystem: true },
  { id: "grabBag", name: "Grab Bag", isSystem: true }, { id: "mayDay", name: "May Day", isSystem: true }, { id: "panPan", name: "Pan Pan", isSystem: true }
];
let checklistsData = {
  leavingDock: [{ id: 1, label: "Tidy lines", checked: false }, { id: 2, label: "Free up head sail furler", checked: false }, { id: 3, label: "Secure Dinghy", checked: false }, { id: 4, label: "Remove main sail cover", checked: false }, { id: 5, label: "Drop lazy jacks", checked: false }, { id: 6, label: "Attach main halyard", checked: false }, { id: 7, label: "Fenders", checked: false }, { id: 8, label: "Wind direction check", checked: false }, { id: 9, label: "Boat hooks ready", checked: false }, { id: 10, label: "Assign crew life jackets", checked: false }, { id: 11, label: "Brief crew on exit plan", checked: false }, { id: 12, label: "Turn on instruments", checked: false }, { id: 13, label: "Set route on Navionics, and ready backup device if needed", checked: false }, { id: 14, label: "Text friend route, destination and ETA", checked: false }, { id: 15, label: "Lodge trip report with Coast Guard", checked: false }, { id: 16, label: "Set timer to close trip report", checked: false }],
  returningDock: [{ id: 17, label: "Fenders out", checked: false }, { id: 18, label: "Mooring lines ready", checked: false }, { id: 19, label: "Engine revs checked", checked: false }, { id: 20, label: "Crew briefed on docking", checked: false }, { id: 21, label: "Ready boat hooks", checked: false }, { id: 22, label: "Prepare crew with arrival plan", checked: false }, { id: 23, label: "Clear arrival timer", checked: false }],
  arrivingDest: [{ id: 24, label: "Ready boat hooks", checked: false }, { id: 25, label: "Anchor ready", checked: false }, { id: 26, label: "Mooring lines ready", checked: false }, { id: 27, label: "Brief crew", checked: false }, { id: 28, label: "Close trip report", checked: false }]
};
checklistsData.safety = [{ id: 29, label: "Lifejackets and PFDs", checked: false }, { id: 30, label: "Flares and distress signals", checked: false }, { id: 31, label: "VHF Radio check", checked: false }, { id: 32, label: "Bilge pumps", checked: false }, { id: 33, label: "First aid kit", checked: false }, { id: 34, label: "Fire extinguishers", checked: false }, { id: 35, label: "Emergency tiller steering check", checked: false }, { id: 36, label: "Throwing line and life ring ready", checked: false }, { id: 37, label: "Emergency Grab Bag Ditch Bag", checked: false }];
checklistsData.routeHazards = [{ id: 38, label: "Tide times check", checked: false }, { id: 39, label: "Shallow areas identified", checked: false }, { id: 40, label: "Weather alerts", checked: false }, { id: 41, label: "Local notices to mariners", checked: false }, { id: 42, label: "Dangerous rocks", checked: false }];
checklistsData.crewPrep = [{ id: 43, label: "Hat with lanyard", checked: false }, { id: 44, label: "Glasses", checked: false }, { id: 45, label: "Sun glasses", checked: false }, { id: 46, label: "Sunscreen", checked: false }, { id: 47, label: "Insect repellent", checked: false }, { id: 48, label: "Scarf", checked: false }, { id: 49, label: "Gloves", checked: false }, { id: 50, label: "Jacket", checked: false }, { id: 51, label: "Sleeping bag", checked: false }, { id: 52, label: "Towel", checked: false }, { id: 53, label: "Toothbrush", checked: false }, { id: 54, label: "Brush", checked: false }, { id: 55, label: "Phone", checked: false }, { id: 56, label: "Credit cards", checked: false }, { id: 57, label: "Cash", checked: false }, { id: 58, label: "Phone cables", checked: false }, { id: 59, label: "Power banks", checked: false }, { id: 60, label: "Sea sickness tablets", checked: false }, { id: 61, label: "White soled trainers", checked: false }];
checklistsData.provisions = [{ id: 62, label: "Water", checked: false }, { id: 63, label: "Beer", checked: false }, { id: 64, label: "Wine", checked: false }, { id: 65, label: "Nuts", checked: false }, { id: 66, label: "Crisps", checked: false }, { id: 67, label: "Dips", checked: false }, { id: 68, label: "Milk", checked: false }, { id: 69, label: "Powdered milk", checked: false }, { id: 70, label: "Tea", checked: false }, { id: 71, label: "Coffee", checked: false }, { id: 72, label: "Juice", checked: false }, { id: 73, label: "Bacon", checked: false }, { id: 74, label: "Sausage", checked: false }, { id: 75, label: "Eggs", checked: false }, { id: 76, label: "Bread", checked: false }, { id: 77, label: "Pasta", checked: false }, { id: 78, label: "Pasta sauce", checked: false }, { id: 79, label: "Mince", checked: false }, { id: 80, label: "Chicken", checked: false }, { id: 81, label: "Burgers", checked: false }, { id: 82, label: "Rice", checked: false }, { id: 83, label: "Potatoes", checked: false }, { id: 84, label: "Carrot", checked: false }, { id: 85, label: "Onion", checked: false }, { id: 86, label: "Tins various", checked: false }];
checklistsData.shipsLog = [{ id: 87, isTemplateLogItem: true, label: "Departed [DATE] at <Time> for <Destination> with <Persons on Board> POB, expected arrival time <Time>.", checked: false }];
checklistsData.grabBag = [{ id: 88, label: "EPIRB Activate and ensure it stays clear of obstructions", checked: false }, { id: 89, label: "Handheld VHF Radio Set to Channel 16 High Power", checked: false }, { id: 90, label: "Handheld GPS and spare batteries", checked: false }, { id: 91, label: "SART Search and Rescue Transponder", checked: false }, { id: 92, label: "Distress Flares Hand flares parachute rockets smoke signals", checked: false }, { id: 93, label: "Thermal Protective Aids TPAs Space blankets", checked: false }, { id: 94, label: "Waterproof torch flashlight and spare batteries", checked: false }, { id: 95, label: "Vessel documentation crew passports and ship logs", checked: false }, { id: 96, label: "Emergency drinking water and high energy rations", checked: false }, { id: 97, label: "First aid kit and critical personal medications", checked: false }, { id: 98, label: "Multi tool pocket knife and signaling mirror", checked: false }, { id: 99, label: "Handheld laser flare whistle", checked: false }];
checklistsData.mayDay = [{ id: 100, label: "Check GPS position Confirm exact Latitude Longitude and milestones", checked: false }, { id: 101, label: "Tune VHF Radio to Channel 16", checked: false }, { id: 102, label: "Transmit: MAYDAY MAYDAY MAYDAY", checked: false }, { id: 103, isMaydayVesselCall: true, label: "This is [Vessel Name], [Vessel Name], [Vessel Name]", checked: false }, { id: 104, label: "Callsign <Callsign>", checked: false }, { id: 105, isMaydayVesselCallsignBlock: true, label: "MAYDAY [Vessel Name] [Callsign]", checked: false }, { id: 106, label: "State Call Sign MMSI number and a brief description of the boat", checked: false }, { id: 107, isMaydayGpsBlock: true, label: "Report position Lat 34 02.15 S / Long 151 13.48 E passed Rock", checked: false }, { id: 108, label: "Nature of distress sinking fire medical emergency", checked: false }, { id: 109, label: "Immediate assistance required", checked: false }, { id: 110, label: "Number of persons on board POB and vital information", checked: false }, { id: 111, label: "OVER", checked: false }, { id: 112, label: "Wait for a response from either Coastguard Radio or Maritime Radio or nearby vessel. They will then ask for more information and confirm assistance is being sent to you as soon as possible. In addition, relay calls will be issued to alert any nearby vessels to your position - this is the benefit of making your Mayday call on the VHF.", checked: false }];
checklistsData.panPan = [{ id: 113, isPanPanGpsBlock: true, label: "Check GPS position Lat 34 02.15 S / Long 151 13.48 E", checked: false }, { id: 114, label: "Tune VHF Radio to Channel 16", checked: false }, { id: 115, label: "Transmit: PAN PAN PAN PAN PAN PAN", checked: false }, { id: 116, label: "State Vessel Name Call Sign and MMSI number", checked: false }, { id: 117, label: "State Current position Lat Long", checked: false }, { id: 118, label: "State Nature of urgency loss of steering steering breakdown", checked: false }, { id: 119, label: "State Intended action assistance required non emergency tow", checked: false }, { id: 120, label: "State Number of persons on board POB and vessel description", checked: false }, { id: 121, label: "OVER", checked: false }, { id: 122, label: "Wait for a response from either Coastguard Radio or Maritime Radio or nearby vessel. They will then ask for more information and confirm assistance is being sent to you as soon as possible. In addition, relay calls will be issued to alert any nearby vessels to your position - this is the benefit of making your Mayday call on the VHF.", checked: false }];
window.onload = function() {
  const now = new Date(); document.getElementById("dateDisplayBar").textContent = now.toISOString().split("T");
  verboseDateString = now.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const savedReg = localStorage.getItem("mbp_registry_v2"); const savedData = localStorage.getItem("mbp_data_v2");
  if (savedReg && savedData) { listRegistry = JSON.parse(savedReg); checklistsData = JSON.parse(savedData); }
  rebuildDropdownMenuOptions(); renderActiveChecklistWorkspace();
};
function assertIdentityConfigured(zone) {
  const vessel = document.getElementById("vesselInput").value.trim(); const skipper = document.getElementById("skipperInput").value.trim(); const callsign = document.getElementById("callsignInput").value.trim();
  if (!vessel || !skipper || !callsign) {
    const targetBar = document.getElementById(zone === "bottom" ? "bottomValidationBar" : "topValidationBar");
    targetBar.classList.remove("hidden"); setTimeout(() => { targetBar.classList.add("hidden"); }, 4000); return false;
  }
  return true;
}
function handleMetaChange() { renderActiveChecklistWorkspace(); }
function handleNetworkToggle() {
  const btn = document.getElementById("statusToggleButton");
  if (isOnline) { isOnline = false; btn.textContent = "Status: Offline"; btn.className = "status-btn offline"; updateHelperLabelText(); }
  else {
    if (confirm("Sync Cloud Database with Offline changes?")) {
      isOnline = true; btn.textContent = "Status: Online"; btn.className = "status-btn online"; updateHelperLabelText();
      outboxQueueCount = 0; document.getElementById("syncAlert").classList.add("hidden");
      const toast = document.getElementById("successToast"); toast.classList.remove("hidden"); setTimeout(() => { toast.classList.add("hidden"); }, 6000);
    }
  }
}
function updateHelperLabelText() {
  const label = document.getElementById("statusHelperLabel");
  if (isOnline) { label.innerHTML = "Click to toggle <span style=\"color:var(--red);font-weight:bold\">OFFLINE</span>"; }
  else {
    if (outboxQueueCount > 0) { label.innerHTML = "Click to toggle <span style=\"color:var(--green);font-weight:bold\">ONLINE</span><br><span style=\"font-size:0.85em;opacity:0.8;\">(and apply pending changes)</span>"; }
    else { label.innerHTML = "Click to toggle <span style=\"color:var(--green);font-weight:bold\">ONLINE</span>"; }
  }
}
function trackMutation() { if (!isOnline) { outboxQueueCount++; document.getElementById("syncCount").textContent = outboxQueueCount; document.getElementById("syncAlert").classList.remove('hidden'); updateHelperLabelText(); } }
function rebuildDropdownMenuOptions() {
  const selector = document.getElementById("categoryMenuSelector"); const activeVal = selector.value || "leavingDock"; selector.innerHTML = "";
  listRegistry.forEach(list => { const opt = document.createElement("option"); opt.value = list.id; opt.textContent = list.name; selector.appendChild(opt); });
  selector.value = activeVal;
}
function openCreateListModal() { if (!assertIdentityConfigured("top")) return; document.getElementById("customListNameInput").value = ""; document.getElementById("modalErrorBar").classList.add("hidden"); document.getElementById("createListModalLayer").classList.remove("hidden"); }
function closeCreateListModal() { document.getElementById("createListModalLayer").classList.add("hidden"); }
function submitNewCustomList() {
  const name = document.getElementById("customListNameInput").value.trim(); const errorBar = document.getElementById("modalErrorBar"); if (!name) return;
  if (listRegistry.some(l => l.name.toLowerCase() === name.toLowerCase())) { errorBar.textContent = name + " already exists"; errorBar.classList.remove("hidden"); return; }
  const newId = "custom_" + Date.now(); listRegistry.push({ id: newId, name: name, isSystem: false }); checklistsData[newId] = [];
  rebuildDropdownMenuOptions(); document.getElementById("categoryMenuSelector").value = newId; closeCreateListModal(); trackMutation(); renderActiveChecklistWorkspace();
}
function renderActiveChecklistWorkspace() {
  const activeKey = document.getElementById("categoryMenuSelector").value || "leavingDock"; const workspace = document.getElementById("checklistRenderWorkspace");
  const inputPlaceholder = document.getElementById("newTaskTextInput"); workspace.innerHTML = "";
  const currentListObj = listRegistry.find(l => l.id === activeKey); inputPlaceholder.placeholder = "My own " + currentListObj.name + " task name...";
  const currentItems = checklistsData[activeKey] || []; const vesselName = document.getElementById("vesselInput").value.trim() || "Vessel Name"; const callsign = document.getElementById("callsignInput").value.trim() || "Callsign";
  currentItems.forEach((item) => {
    let displayLabel = item.label; if (item.isTemplateLogItem) displayLabel = item.label.replace("[DATE]", verboseDateString); else if (item.isMaydayVesselCall) displayLabel = "This is " + vesselName + ", " + vesselName + ", " + vesselName; else if (item.isMaydayVesselCallsignBlock) displayLabel = "MAYDAY " + vesselName + " " + callsign;
    const div = document.createElement("div"); div.className = "list-item";
    div.innerHTML = `<div class="item-left"><input type="checkbox" class="item-checkbox" ${item.checked ? "checked" : ""} onchange="toggleItemState('${activeKey}',${item.id})"><span class="item-text ${item.checked ? "checked" : ""}">${displayLabel}</span></div><div class="item-actions"><button class="icon-btn" onclick="editItemText('${activeKey}',${item.id})">Edit</button><button class="icon-btn" onclick="deleteItem('${activeKey}',${item.id})">Delete</button></div>`;
    workspace.appendChild(div);
  });
}
function switchActiveCategory() { renderActiveChecklistWorkspace(); }
function toggleItemState(cat, id) { if (!assertIdentityConfigured("top")) { renderActiveChecklistWorkspace(); return; } const item = checklistsData[cat].find(i => i.id === id); if (item) { item.checked = !item.checked; trackMutation(); } renderActiveChecklistWorkspace(); }
function addNewCustomTaskItem() {
  if (!assertIdentityConfigured("bottom")) return; const input = document.getElementById("newTaskTextInput"); const text = input.value.trim(); const alertBox = document.getElementById("taskItemAlertContainer"); const activeKey = document.getElementById("categoryMenuSelector").value;
  if (!text) { alertBox.textContent = "Nothing to add"; alertBox.classList.remove("hidden"); setTimeout(() => { alertBox.classList.add("hidden"); }, 4000); return; }
  if (checklistsData[activeKey].some(i => i.label.toLowerCase() === text.toLowerCase())) { alertBox.textContent = text + " already exists"; alertBox.classList.remove("hidden"); setTimeout(() => { alertBox.classList.add("hidden"); }, 4000); return; }
  checklistsData[activeKey].push({ id: Date.now(), label: text, checked: false }); input.value = ""; trackMutation(); renderActiveChecklistWorkspace();
}
function editItemText(cat, id) { if (!assertIdentityConfigured("top")) return; const item = checklistsData[cat].find(i => i.id === id); if (item) { const newText = prompt("Edit item text:", item.label); if (newText !== null && newText.trim() !== "") { item.label = newText.trim(); trackMutation(); renderActiveChecklistWorkspace(); } } }
function deleteItem(cat, id) { if (!assertIdentityConfigured("top")) return; checklistsData[cat] = checklistsData[cat].filter(i => i.id !== id); trackMutation(); renderActiveChecklistWorkspace(); }
function resetActiveChecklist(zone) { if (!assertIdentityConfigured(zone)) return; const activeKey = document.getElementById("categoryMenuSelector").value; checklistsData[activeKey].forEach(i => i.checked = false); trackMutation(); renderActiveChecklistWorkspace(); }
function saveListsToDevice(zone) { if (!assertIdentityConfigured(zone)) return; localStorage.setItem("mbp_registry_v2", JSON.stringify(listRegistry)); localStorage.setItem("mbp_data_v2", JSON.stringify(checklistsData)); alert("Local Storage Synced: Your checklist changes are locked onto this device framework."); }
function enterDocumentPreview(isCurrentOnly, zone) {
  if (!assertIdentityConfigured(zone)) return;
  document.getElementById("printVesselValue").textContent = document.getElementById("vesselInput").value.trim();
  document.getElementById("printSkipperValue").textContent = document.getElementById("skipperInput").value.trim();
  document.getElementById("printCallsignValue").textContent = document.getElementById("callsignInput").value.trim();
  document.getElementById("printDateValue").textContent = verboseDateString;
  const printContainer = document.getElementById("printListsCompiledContainer"); printContainer.innerHTML = ""; const activeKey = document.getElementById("categoryMenuSelector").value;
  if (isCurrentOnly) { const currentListObj = listRegistry.find(l => l.id === activeKey); document.getElementById("printManifestHeaderTitle").textContent = currentListObj.name.toUpperCase(); compileListBlockForPrint(activeKey, printContainer); }
  else {
    document.getElementById("printManifestHeaderTitle").textContent = "Vessel Manifest Master Logs";
    listRegistry.forEach((list, index) => {
      const blockDiv = document.createElement("div"); blockDiv.className = `print-list-block ${index > 0 ? "page-break" : ""}`;
      const header = document.createElement("div"); header.className = "print-category-header"; header.textContent = list.name.toUpperCase(); blockDiv.appendChild(header);
      compileListBlockForPrint(list.id, blockDiv); printContainer.appendChild(blockDiv);
    });
  }
  document.getElementById("appUiShell").classList.add("hidden"); document.getElementById("laminationPrintLayer").classList.remove("hidden"); window.scrollTo(0, 0);
}
function compileListBlockForPrint(cat, containerElement) {
  const items = checklistsData[cat] || []; const vesselName = document.getElementById("vesselInput").value.trim() || "Vessel Name"; const callsign = document.getElementById("callsignInput").value.trim() || "Callsign";
  items.forEach((item) => {
    let displayLabel = item.label; if (item.isMaydayVesselCall) displayLabel = "This is " + vesselName + ", " + vesselName + ", " + vesselName; else if (item.isMaydayVesselCallsignBlock) displayLabel = "MAYDAY " + vesselName + " " + callsign;
    const row = document.createElement("div"); row.className = "print-row"; row.innerHTML = `<div class="print-box ${item.checked ? "checked" : ""}"></div><div class="print-row-text ${item.checked ? "checked" : ""}">${displayLabel}</div>`; containerElement.appendChild(row);
  });
}
function exitDocumentPreview() { document.getElementById("laminationPrintLayer").classList.add("hidden"); document.getElementById("appUiShell").classList.remove("hidden"); }
