import { BookOpen, PartyPopper, Route } from "lucide-react";
import { Bullets, GoOn, GuideSection, GuideText, P } from "@/components/boat/guide/GuideParts";
import { reached, useGuideSteps, useHold } from "@/lib/tripGuide";

const UNDERWAY = ["vessel-arrived-underway"];
const ARRIVED = ["vessel-arrived-all-done-btn"];

const LeaveDock = ({ guide }) => {
  const active = guide.stage === "leave";
  useGuideSteps(guide, "leave", [["depart-all-done-btn"]], active);
  return (
    <GuideSection title="Instructions for Leaving the Dock" active={active} testId="trip-guide-leave" onSkip={guide.skip}>
      <P>When clicking DEPART, ALL CHECKS DONE, you will be asked to:</P>
      <Bullets testId="trip-guide-leave-lines" items={["First \"Confirm Levels\": Fuel, LPG, Water and Battery levels", "\"Depart now\" checks: have a look at what is ticked, and what goes into the log"]} />
      <P>Once &quot;Depart now&quot; has been clicked, the UNDERWAY banner shows on every list.</P>
      {active && <>
        <GoOn onClick={() => guide.to("leaveOk")} label="OK, I've got that" testId="trip-guide-leave-ok-btn" />
        <p className="text-xs font-bold text-[var(--navy)]" data-testid="trip-guide-leave-ok-note">I will click DEPART, ALL CHECKS DONE</p>
      </>}
    </GuideSection>
  );
};

const ArriveHow = ({ guide }) => {
  const active = guide.stage === "underway";
  const n = useGuideSteps(guide, "underway", [UNDERWAY, ARRIVED], active);
  return (
    <GuideSection title="Instructions for Arriving at Destination" active={active} testId="trip-guide-arrive" onSkip={guide.skip}>
      <Bullets testId="trip-guide-arrive-lines" items={[
        "Clicking \"ARRIVED, ALL ARRIVAL CHECKS DONE\" shows a \"Confirm your arrival levels\" window. The levels default to the departure levels, so set them as appropriate.",
        "You will then get an \"About to log your arrival\" window.",
        "You will then be switched into the \"Arriving at Destination\" list.",
        "Make sure the \"Arriving at Destination\" default checks are suitable.",
      ]} />
      <P>Note:</P>
      <Bullets testId="trip-guide-arrive-notes" items={[
        "The Arrive bubble is the \"Arriving at Destination\" list.",
        "\"Arriving at Destination\" has a \"Trip Planning\" return bubble, so you can easily go back and see the plan.",
        "\"Arriving at Destination\" also has a \"Route\" bubble, so you can see the trip status.",
        "You can hop around the plan, arriving, returning to dock and the overall route.",
      ]} />
      <P>This lets you make sure your plan, departure and arrival checklists are all good to go.</P>
      {active && n >= 2 && <GoOn onClick={() => guide.to("types")} testId="trip-guide-arrive-continue-btn" />}
    </GuideSection>
  );
};

const ArriveTypes = ({ guide }) => {
  const active = guide.stage === "types";
  return (
    <GuideSection title="Arriving at Destination Types, and logging" active={active} testId="trip-guide-types" onSkip={guide.skip}>
      <P>You&apos;ll notice that all types of arrival are catered for:</P>
      <Bullets testId="trip-guide-types-lines" items={["If anchoring", "If mooring", "If berthing"]} />
      <P>so you can go through the checks for each of these ARRIVING AT DESTINATION TYPES. The &quot;About to log your arrival&quot; window lets you DROP ANCHOR, ARRIVE BERTH or ARRIVE MOORING, so you arrive at your destination, and the &quot;Arriving at Destination&quot; list ticks the checks for that type of arrival.</P>
      {active && <GoOn onClick={() => guide.to("click")} testId="trip-guide-types-continue-btn" />}
    </GuideSection>
  );
};

// Until ARRIVED is tapped (gone while its windows are open).
const ClickArrived = ({ busy }) => {
  useHold(ARRIVED[0], !busy);
  return busy ? null : <GuideText testId="trip-guide-click-arrived">Click ARRIVED, ALL ARRIVAL CHECKS DONE</GuideText>;
};

const ROUTE = "arrivingDest-hop-view-btn";
const RouteStatus = ({ guide }) => {
  const active = guide.stage === "arrived";
  const n = useGuideSteps(guide, "arrived", [["arrived-all-done-btn", "arrivingDest-hop-route-btn", "arrivingDest-hop-returningDock-btn", ROUTE]], active);
  useHold(ROUTE, active && n >= 1);
  return (
    <GuideSection title="Instructions for Arriving at Destination" active={active} testId="trip-guide-route" onSkip={guide.skip}>
      <GuideText testId="trip-guide-route-text">Click Route to see the status of the trip.</GuideText>
      <P>Notice on the Planned route window that:</P>
      <Bullets testId="trip-guide-route-lines" items={[
        "it is showing a DEPARTED badge and an ARRIVED badge",
        "there is also a prep step to the right of the ARRIVED badge",
        "the prep step will match your trip planning",
        "the prep step will likely be \"Prepare to pick up buoy\", because in your Trip Planning the default was a MOORING arrival",
      ]} />
      <P>Click on those instructions and make sure they suit your boat. If not, check the Arriving at Destination list.</P>
      {active && n >= 1 && <GoOn onClick={() => guide.to("newdep")} testId="trip-guide-route-continue-btn" />}
    </GuideSection>
  );
};

const NewDeparture = ({ guide }) => {
  const active = guide.stage === "newdep";
  useGuideSteps(guide, "newdep", [["arrival-new-departure-btn"]], active);
  useHold("interim-departure-mooring-btn", guide.stage === "newdep" || guide.stage === "newdepGo");
  return (
    <GuideSection title={"Arriving at Destination, setting \"New departure\""} active={active} testId="trip-guide-newdep" onSkip={guide.skip}>
      <P>Clicking &quot;New departure&quot; will:</P>
      <Bullets testId="trip-guide-newdep-lines" items={[
        "let you confirm your levels",
        "let you set off on your return to the marina",
        "set \"Returning to Dock\" as the ARRIVING AT DESTINATION TYPE",
        "then click \"LEAVE MOORING\" to get UNDERWAY",
      ]} />
      <GuideText testId="trip-guide-newdep-text">On &quot;Arriving at Destination&quot;, click &quot;New departure&quot;.</GuideText>
      {active && <GoOn onClick={() => guide.to("newdepGo")} testId="trip-guide-newdep-continue-btn" />}
    </GuideSection>
  );
};

// Underway again after the New departure: over to Returning to Dock to arrive back.
const HeadHome = ({ guide, listId }) => {
  const active = guide.stage === "returning";
  const home = listId === "returningDock";
  useGuideSteps(guide, `returning-${listId}`, [UNDERWAY, ARRIVED], active && home);
  useHold("arrivingDest-hop-returningDock-btn", active && !home);
  return (
    <GuideSection title="Returning to Dock" active={active} testId="trip-guide-returning" onSkip={guide.skip}>
      <P>The UNDERWAY badge shows prominently again on every list.</P>
      <GuideText testId="trip-guide-returning-text">Click &quot;Return&quot;, and you will see the UNDERWAY badge. Review the &quot;Returning to Dock&quot; checklist and click &quot;ARRIVED, ALL CHECKS DONE&quot;. Click Route, and you will see the status has changed to DEPARTED again.</GuideText>
      {home && <GuideText testId="trip-guide-returning-click">Click &quot;ARRIVED&quot;</GuideText>}
    </GuideSection>
  );
};

const Complete = ({ guide, onShipsLog, onTripPlanning }) => (
  <section className="flex flex-col gap-2 rounded-md border-2 border-yellow-500 bg-yellow-100 p-3" data-testid="trip-guide-complete">
    <p className="flex items-center gap-2 font-display text-base font-extrabold text-[var(--navy)]"><PartyPopper className="h-5 w-5" /> Trip Planning guide complete</p>
    <P testId="trip-guide-complete-text">Well done! You planned a trip on the Model Vessel, left the dock, arrived at your destination, set off again and returned to the dock. Every step was logged in the Model Vessel&apos;s Ship&apos;s Log. You can go through this guide again any time from Help &gt; Model Vessel.</P>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-ghost h-11 gap-2 px-4" onClick={onShipsLog} data-testid="trip-guide-complete-log-btn"><BookOpen className="h-4 w-4" /> Open the Ship&apos;s Log</button>
      <GoOn onClick={() => guide.to("done")} label="Finish guide" testId="trip-guide-complete-finish-btn" />
    </div>
    <P testId="trip-guide-complete-archive-text">Reminder: archive this Model Vessel guide trip to try the same trip again, or to try a variation with another midpoint.</P>
    <button type="button" onClick={() => { guide.set({ archive: true }); onTripPlanning(); }}
      className="inline-flex min-h-8 items-center gap-1.5 self-start rounded-full border-2 border-[var(--navy)] bg-white px-3 py-1 text-left text-xs font-extrabold text-[var(--navy)] shadow-sm hover:bg-slate-100 active:scale-95 [transition:background-color_.15s,transform_.1s]"
      data-testid="trip-guide-complete-archive-btn"><Route className="h-3.5 w-3.5 shrink-0" /> Take me to &quot;Trip Planning&quot; where I can archive the trip</button>
  </section>
);

// Leaving the Dock, Arriving at Destination and Returning to Dock on the Model Vessel: the guide's parts for that list, under its bubbles.
// busy: an ARRIVED window is open.
export const TripListGuide = ({ guide, listId, busy, onShipsLog, onTripPlanning }) => {
  const s = guide.stage;
  if (listId === "leavingDock") return reached(s, "leave") && (
    <div className="flex flex-col gap-2" data-testid="trip-guide-leaving">
      <LeaveDock guide={guide} />
      {reached(s, "underway") && <ArriveHow guide={guide} />}
      {reached(s, "types") && <ArriveTypes guide={guide} />}
      {s === "click" && <ClickArrived busy={busy} />}
    </div>
  );
  if (listId === "arrivingDest") return (s === "click" || reached(s, "arrived")) && (
    <div className="flex flex-col gap-2" data-testid="trip-guide-arriving">
      {s === "click" && <ClickArrived busy={busy} />}
      {reached(s, "arrived") && <RouteStatus guide={guide} />}
      {reached(s, "newdep") && <NewDeparture guide={guide} />}
      {reached(s, "returning") && <HeadHome guide={guide} listId={listId} />}
    </div>
  );
  return reached(s, "returning") && (
    <div className="flex flex-col gap-2" data-testid="trip-guide-home">
      <HeadHome guide={guide} listId={listId} />
      {s === "complete" && <Complete guide={guide} onShipsLog={onShipsLog} onTripPlanning={onTripPlanning} />}
    </div>
  );
};
