p='/app/frontend/src/components/boat/CrewDialog.jsx'; s=open(p).read()
a='''          </TripGroup>)); })()}
        </div>
'''
assert a in s
s=s.replace(a,a+'''        <ShoreContacts boat={boat} online={online} onTrackingChange={(t) => window.dispatchEvent(new CustomEvent("mbp:tracking", { detail: { boat_id: boat.boat_id, tracking: t } }))} />
''',1)
s=s.replace('''import { JoinCrewBadge } from "@/components/boat/crew/JoinCrewBadge";''','''import { JoinCrewBadge } from "@/components/boat/crew/JoinCrewBadge";
import { ShoreContacts } from "@/components/boat/shore/ShoreContacts";''',1)
open(p,'w').write(s)

p='/app/frontend/src/hooks/useShoreTracking.js'; s=open(p).read()
s=s.replace('''import { useEffect, useRef } from "react";''','''import { useEffect, useRef, useState } from "react";''')
s=s.replace('''export default function useShoreTracking(boat, gps, online) {
  const on = !!boat?.tracking?.on && !!boat?.tracking?.trip_id && !boat?.charter_lock;
  const owner = boat?.crew ? boat.owner_id : "";
  const trip = boat?.tracking?.trip_id;''','''export default function useShoreTracking(boat, gps, online) {
  // The skipper's switch or the server's reply can change tracking before the boat list refreshes.
  const [override, setOverride] = useState(null);
  const key = boat ? `${boat.owner_id || ""}|${boat.boat_id}` : "";
  useEffect(() => {
    const on = (e) => { if (!boat?.crew && e.detail.boat_id === boat?.boat_id) setOverride({ key, tracking: e.detail.tracking }); };
    window.addEventListener("mbp:tracking", on);
    return () => window.removeEventListener("mbp:tracking", on);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const tracking = override?.key === key ? override.tracking : boat?.tracking;
  const on = !!tracking?.on && !!tracking?.trip_id && !boat?.charter_lock;
  const owner = boat?.crew ? boat.owner_id : "";
  const trip = tracking?.trip_id;
  const send = () => flush().then((t) => { if (t && (t.on !== tracking?.on || t.trip_id !== tracking?.trip_id)) setOverride({ key, tracking: t }); });''')
s=s.replace('''    if (navigator.onLine) flush();
  };

  // A new position''','''    if (navigator.onLine) send();
  };

  // A new position''')
s=s.replace('''      if (navigator.onLine) flush();
    };
    tick();''','''      if (navigator.onLine) send();
    };
    tick();''')
s=s.replace('''  useEffect(() => { if (online) flush(); }, [online]);''','''  useEffect(() => { if (online && boat) send(); }, [online, key]); // eslint-disable-line react-hooks/exhaustive-deps''')
open(p,'w').write(s)

p='/app/frontend/src/App.js'; s=open(p).read()
s=s.replace('''import JoinCrew from "@/pages/JoinCrew";''','''import JoinCrew from "@/pages/JoinCrew";
import ShoreWatch from "@/pages/ShoreWatch";
import ShoreJoin, { SHORE_JOIN_KEY } from "@/pages/ShoreJoin";''')
s=s.replace('''function UserBoat() {
  const { user } = useAuth();
  return''','''function UserBoat() {
  const { user } = useAuth();
  const shoreToken = localStorage.getItem(SHORE_JOIN_KEY);
  if (shoreToken) return <Navigate to={`/shore/join/${shoreToken}`} replace />;
  if (user.home === "shore") return <Navigate to="/shore" replace />;
  return''')
s=s.replace('''      <Route path="/join/:token" element={<JoinCrew />} />''','''      <Route path="/join/:token" element={<JoinCrew />} />
      <Route path="/shore/join/:token" element={<ShoreJoin />} />
      <Route path="/shore" element={<RequireAuth><ShoreWatch /></RequireAuth>} />''')
open(p,'w').write(s)

p='/app/frontend/src/pages/BoatPrep.jsx'; s=open(p).read()
s=s.replace('''  const gps = useGps();''','''  const gps = useGps();
  useShoreTracking(boats.current, gps, online);''',1)
s=s.replace('''import useGps''','''import useShoreTracking from "@/hooks/useShoreTracking";
import useGps''',1)
open(p,'w').write(s)
print("ok")
