import { useState } from "react";
import { Ship } from "lucide-react";
import { API } from "@/lib/api";

export const photoUrl = (b) => `${API}/boats/${b.boat_id}/photo?${b.owner_id ? `owner=${encodeURIComponent(b.owner_id)}&` : ""}v=${encodeURIComponent(b.photo_v)}`;

export const BoatPhoto = ({ boat, size = "h-12 w-12", testId }) => {
  const [failed, setFailed] = useState(null);
  const show = boat.photo_v && failed !== boat.photo_v;
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--navy)] bg-sky-50 text-[var(--navy)]`} data-testid={testId}>
      {show ? <img src={photoUrl(boat)} alt="" className="h-full w-full object-cover" onError={() => setFailed(boat.photo_v)} data-testid={testId && `${testId}-img`} />
        : <Ship className="h-1/2 w-1/2" aria-hidden="true" />}
    </span>
  );
};
