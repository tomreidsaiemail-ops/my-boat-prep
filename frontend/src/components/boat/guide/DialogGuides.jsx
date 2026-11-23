import { useEffect, useState } from "react";
import { Bullets, GoOn, GuideSection, GuideText, P } from "@/components/boat/guide/GuideParts";
import { glow } from "@/lib/glow";
import { useGuideSteps, useHold } from "@/lib/tripGuide";

const DEPART_STEPS = [["all-done-step-tick"], ["all-done-step-underway"], ["all-done-step-shore"]];

// Top of the "About to depart" window: each step highlighted in turn, then Continue folds this and keeps "Depart now" highlighted.
export const DepartGuide = ({ guide }) => {
  const [folded, setFolded] = useState(false);
  const n = useGuideSteps({ ...guide, seen: {} }, "depart", DEPART_STEPS);
  useHold("all-done-confirm-btn", folded);
  return (
    <GuideSection title={"\"About to depart\" help and instructions"} active={!folded} testId="trip-guide-depart">
      <P testId="trip-guide-depart-review">Make sure you review your own Leaving the Dock instructions, as the crew will be able to review these. It&apos;s good if they are correct.</P>
      {n >= 1 && <P testId="trip-guide-depart-underway">Watch out for the green UNDERWAY badge that shows prominently on every list.</P>}
      {n >= 2 && <P testId="trip-guide-depart-shore">If you set up a shore contact, make sure you keep My Boat Prep open for the start and end, and even the occasional check. Should a MAYDAY or a PAN-PAN call be needed, the shore contact will be fully briefed and be the best person to contact. If anyone taps MAYDAY or PAN-PAN, the shore contact will double check with you in the app, and can call a crew member for an update if you are within range or have Starlink.</P>}
      {n >= 3 && <>
        <GuideText testId="trip-guide-depart-click">Click Depart now.</GuideText>
        {!folded && <GoOn onClick={() => setFolded(true)} testId="trip-guide-depart-continue-btn" />}
      </>}
    </GuideSection>
  );
};

// Top of "About to log your arrival" at the midpoint: why End of trip stays unticked; Continue folds this and keeps ARRIVE MOORING yellow until pressed.
export const EndTripGuide = () => {
  const [folded, setFolded] = useState(false);
  useHold("all-done-end-trip", !folded);
  useHold("all-done-choice-mooring", folded);
  const go = () => {
    setFolded(true);
    setTimeout(() => document.querySelector('[data-testid="all-done-choice-mooring"]')?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };
  return (
    <GuideSection title="End of trip instructions" active={!folded} testId="trip-guide-end-trip">
      <GuideText testId="trip-guide-end-trip-text">Since this is a midpoint arrival, we leave &quot;End of trip&quot; unchecked. The system will check it for us when arriving on our last leg.</GuideText>
      {!folded && <GoOn onClick={go} testId="trip-guide-end-trip-continue-btn" />}
    </GuideSection>
  );
};

// Top of the Quick Draft Plan window: how to zoom and tap the three points; Continue folds it.
// destination: the DESTINATION's popup is up, so its 3rd option (come back to the start) is highlighted.
export const MapGuide = ({ destination }) => {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (!destination) return undefined;
    const t = setTimeout(() => glow("quick-plan-return-btn", 5000), 300);
    return () => clearTimeout(t);
  }, [destination]);
  return (
    <GuideSection title="Map zoom, and clicking instructions" active={!folded} testId="trip-guide-map">
      <Bullets testId="trip-guide-map-lines" items={[
        "Click a local marina (START)",
        "Click a mooring or an anchorage (DESTINATION)",
        "(When clicking a mooring or an anchorage, choose the 3rd option to return)",
        "Click Done Quick Draft Plan when you have 3 points",
      ]} />
      <P testId="trip-guide-map-note">Note: zoom into a marina or a bay until a name appears on the map, then tap that point. Repeat for your destination. The DEPARTING POINT gets set with whatever is under your tap. If it isn&apos;t filled in, try again with &quot;Ignore this tap&quot;, or &quot;Undo Last Pin&quot;.</P>
      {!folded && <GoOn onClick={() => setFolded(true)} hold testId="trip-guide-map-continue-btn" />}
    </GuideSection>
  );
};
