import { useRef, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { HopBubble } from "@/components/boat/navigator/HopBubble";
import { TripConfirm } from "@/components/boat/navigator/TripConfirm";

// Leg 1 of the planned route: the Route Planning START and DESTINATION.
export const firstLeg = (start, dest, weather = {}) => ({ id: "plan", route_start: start, route_dest: dest, depart_at: weather.depart_at || "", finish_at: weather.finish_at || "",
  arrive_type: weather.arrive_type || "", start_pos: weather.start_pos, dest_pos: weather.dest_pos, path: weather.path });

// The planned route (Leg 1, then each planned leg) on its Stops and Map tabs, where pins can be moved.
export const PlannedRouteView = ({ start, dest, weather = {}, name, onChange, onClose, done }) => {
  const legs = weather.legs || [];
  // Routes drawn over water can land before the next render, so each builds on the latest legs.
  const latest = useRef(legs);
  latest.current = legs;
  const putLegs = (patch, next) => { latest.current = next; onChange({ ...patch, legs: next }); };
  // Stop 1 is the Route Plan START, stop 2 its DESTINATION, then each planned leg's DESTINATION. Leg 1's line is weather.path.
  const clearPaths = (ls, patch, ks) => ks.reduce((acc, k) => (k < 0 || k > legs.length ? acc : k === 0 ? { ...acc, patch: { ...acc.patch, path: null } }
    : { ...acc, ls: acc.ls.map((l, n) => (n === k - 1 ? { ...l, path: null } : l)) }), { ls, patch });
  const place = (i, pos) => {
    const ls = i > 1 ? latest.current.map((l, n) => (n === i - 2 ? { ...l, dest_pos: pos } : l)) : latest.current;
    // The skipper's waypoints stay put when a pin moves (a cleared pin also clears its legs' waypoints).
    const out = clearPaths(ls, i === 0 ? { start_pos: pos } : i === 1 ? { dest_pos: pos } : {}, pos ? [] : [i - 1, i]);
    if (out.ls !== latest.current) putLegs(out.patch, out.ls); else onChange(out.patch);
  };
  const setPath = (k, pts) => (k === 0 ? onChange({ path: pts }) : putLegs({}, latest.current.map((l, n) => (n === k - 1 ? { ...l, path: pts } : l))));
  const redraw = () => onChange({ path: null, legs: legs.map((l) => ({ ...l, path: null })) });
  return <TripConfirm open legs={[firstLeg(start, dest, weather), ...legs]} name={name} onClose={onClose} onPlace={place} onPath={setPath} onRedraw={redraw} done={done} />;
};

// The "Route" bubble: fast access to the planned route from Route Planning, Arriving at Destination and Returning to Dock.
export const RouteBubble = ({ testId, ...view }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HopBubble icon={MapIcon} label="Route" onClick={() => setOpen(true)} testId={testId} />
      {open && <PlannedRouteView {...view} onClose={() => setOpen(false)} />}
    </>
  );
};
