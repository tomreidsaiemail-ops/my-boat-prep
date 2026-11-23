import { useEffect } from "react";
import { Bullets, GoOn, GuideSection, GuideText, P } from "@/components/boat/guide/GuideParts";
import { reached, spot, useGuideSteps, useHold } from "@/lib/tripGuide";

const Intro = ({ guide }) => {
  const active = guide.stage === "intro";
  useHold("route-start-input", active);
  useHold("route-dest-input", active);
  return (
    <GuideSection title="Trip planning Introduction" active={active} testId="trip-guide-intro" onSkip={guide.skip}>
      <GuideText testId="trip-guide-intro-text">Welcome to Trip Planning on the Model Vessel. This step-by-step guide takes you through a whole trip, from planning it to arriving back at the dock. Everything you log goes into the Model Vessel&apos;s Ship&apos;s Log, not your own boat&apos;s.</GuideText>
      <P>Trip Planning applies when arranging:</P>
      <Bullets testId="trip-guide-intro-kinds" items={["a day trip, say fishing, returning to dock", "a return trip, going somewhere, anchoring, then returning to dock", "a trip somewhere", "or a trip somewhere for days, and returning to dock"]} />
      <P>START and DESTINATION are highlighted above. The rest of Trip Planning is hidden for now, so you can focus on the bubbles, the Quick Draft Plan, and the START and DESTINATION.</P>
      {active && <GoOn onClick={() => guide.to("bubbles")} testId="trip-guide-intro-continue-btn" />}
    </GuideSection>
  );
};

const BUBBLES = ["route-leaving-dock-btn", "route-arriving-btn", "route-returning-dock-btn", "route-view-btn", "route-crew-btn", "route-prep-btn", "route-roles-btn"];
// The list picker and all 7 bubbles together, then each bubble on its own as its line shows.
const BUBBLE_STEPS = [["list-selector", ...BUBBLES], ...BUBBLES.map((id) => [id])];
const BUBBLE_LINES = [
  ["Trip Planning: create a trip plan."],
  ["\"Leave\" the dock with a checklist, and signal the UNDERWAY banner in the app."],
  ["\"Arrive\" lets you follow your anchoring, berthing or mooring checklists.", "\"Arrive\" also lets you remove the UNDERWAY banner, and get UNDERWAY again, by weighing anchor say."],
  ["\"Return\" lets you return to the dock, and also removes the UNDERWAY banner."],
  ["\"Route\": when you have a green 1 circle, some black circle mid points and a red circle end point, you can view your route."],
  ["\"Crew\" lets you register and invite crew, and prepare them for the trip."],
  ["\"Prep\" is your generic set of prep instructions given to all crew members.", "\"Prep\" is copied to Crew Prep - Tom, Crew Prep - Dick and Crew Prep - Harry, and you can monitor their prep once they're invited."],
  ["\"Roles\" is the set of roles set up by the system, and you can add your own. They include essential boat prep instructions given to all crew members."],
];

const Bubbles = ({ guide }) => {
  const active = guide.stage === "bubbles";
  const n = useGuideSteps(guide, "bubbles", BUBBLE_STEPS, active);
  return (
    <GuideSection title="Trip planning bubbles, Model Vessel help" active={active} testId="trip-guide-bubbles" onSkip={guide.skip}>
      <GuideText testId="trip-guide-bubbles-text">These bubbles let you move through every part of your trip: planning it, getting underway, arriving and, if you want, returning. When you click any of the bubbles, there is a return bubble to bring you right back here to Trip Planning.</GuideText>
      <Bullets testId="trip-guide-bubbles-lines" items={BUBBLE_LINES.slice(0, n + 1).flat()} />
      {n >= BUBBLE_STEPS.length && <>
        <P testId="trip-guide-bubbles-try">Now is a good time to click on the bubbles to see how the list changes, but make sure you come back to Trip Planning with the Trip Planning return bubble. This is what you would normally do when doing a trip plan for real.</P>
        {active && <GoOn onClick={() => guide.to("quick")} testId="trip-guide-bubbles-continue-btn" />}
      </>}
    </GuideSection>
  );
};

const Quick = ({ guide, onQuick }) => {
  const active = guide.stage === "quick" || guide.stage === "map";
  useHold("quick-plan-btn", active);
  useEffect(() => {
    if (guide.stage !== "quick" || guide.seen.quick) return undefined;
    const t = setTimeout(() => { spot(["trip-guide-quick-text"]); guide.see("quick"); }, 300);
    return () => clearTimeout(t);
  }, [guide.stage]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <GuideSection title="Quick Draft Plan Introduction" active={active} testId="trip-guide-quick" onSkip={guide.skip}>
      <P testId="trip-guide-quick-text">Choosing Quick Draft Plan lets you quickly set up a green start point, a midpoint (the place you are going) and a red end point, which can be the same as the green start point.</P>
      {active && <GoOn onClick={onQuick} label="Continue to Quick Draft Plan" hold testId="trip-guide-quick-continue-btn" />}
    </GuideSection>
  );
};

const FILLED = ["route-start-input", "route-dest-input", "navigator-event-name-input", "navigator-depart-at-field", "navigator-finish-at-field"];
const FILLED_STEPS = [FILLED, ["navigator-depart-at-set-now-btn", "navigator-finish-at-set-now-btn"], ["route-leaving-dock-btn"]];

const Filled = ({ guide }) => {
  const active = guide.stage === "filled";
  const n = useGuideSteps(guide, "filled", FILLED_STEPS, active);
  return (
    <GuideSection title="Prepare to leave today - override date and time defaults" active={active} testId="trip-guide-filled" onSkip={guide.skip}>
      <GuideText testId="trip-guide-filled-text">These are filled out for you: START and DESTINATION, EVENT OR TRIP NAME, DEPARTURE DATE AND TIME and ESTIMATED FINISH DATE AND TIME.</GuideText>
      {n >= 1 && <P testId="trip-guide-filled-name">You should choose a more appropriate EVENT OR TRIP NAME than &quot;Quick Draft Plan&quot;, but for the moment you can leave it as it is. However, to depart you need a date today. The system defaults the departure and estimated finish times to leaving tomorrow, and you&apos;ll likely always change these as well.</P>}
      {n >= 2 && <GuideText testId="trip-guide-filled-set-now">So click &quot;set now&quot; and &quot;set now + 2hr&quot; to allow a departure.</GuideText>}
      {n >= 3 && <GuideText testId="trip-guide-filled-leave">Then click the Leave bubble, which takes you to Leaving the Dock, where you can depart with all your checks done.</GuideText>}
    </GuideSection>
  );
};

// Trip Planning on the Model Vessel, under START and DESTINATION: each part of the guide in turn, the finished ones folded.
export const TripPlanGuide = ({ guide, onQuick }) => (
  <div className="flex flex-col gap-2" data-testid="trip-guide">
    <Intro guide={guide} />
    {reached(guide.stage, "bubbles") && <Bubbles guide={guide} />}
    {reached(guide.stage, "quick") && <Quick guide={guide} onQuick={onQuick} />}
    {reached(guide.stage, "filled") && <Filled guide={guide} />}
  </div>
);
