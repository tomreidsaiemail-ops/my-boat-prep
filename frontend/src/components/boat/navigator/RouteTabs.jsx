import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useFeature } from "@/lib/features";

const WARNED = (uid) => `mbp_route_map_warned:${uid}`;

// Planned route: the Stops tab, plus the Map tab when "Planned route map tab Feature" is on (warning shown the first time).
export const RouteTabs = ({ stops, map }) => {
  const uid = useAuth()?.user?.user_id || "";
  const mapOn = useFeature("route_map");
  const [tab, setTab] = useState("stops");
  const [ask, setAsk] = useState(false);
  const pick = (v) => (v === "map" && !localStorage.getItem(WARNED(uid)) ? setAsk(true) : setTab(v));
  const agree = () => { localStorage.setItem(WARNED(uid), "1"); setAsk(false); setTab("map"); };
  return (
    <>
      <Tabs value={mapOn ? tab : "stops"} onValueChange={pick} className="flex flex-col gap-3">
        <TabsList className={`grid h-11 w-full ${mapOn ? "grid-cols-2" : "grid-cols-1"}`}>
          <TabsTrigger value="stops" className="h-9 font-bold" data-testid="trip-view-stops-tab">Stops</TabsTrigger>
          {mapOn && <TabsTrigger value="map" className="h-9 font-bold" data-testid="trip-view-map-tab">Map</TabsTrigger>}
        </TabsList>
        <TabsContent value="stops" className="mt-0">{stops}</TabsContent>
        {mapOn && <TabsContent value="map" className="mt-0">{map}</TabsContent>}
      </Tabs>
      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="route-map-warning-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display text-lg font-black text-[var(--navy)]"><AlertTriangle className="h-5 w-5 text-amber-600" /> Rough outline map</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-[var(--ink)]" data-testid="route-map-warning-text">
              This is a rough outline map of the planned route. Mainly for shore contact communication, and to warn the crew to prepare to run anchoring, berthing and mooring checklists. Use your normal navigation tools to plan your navigation on the water.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="route-map-warning-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={agree} data-testid="route-map-warning-ok-btn">OK, show the map</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
