import { useState } from "react";
import { photoUrl } from "@/components/boat/BoatPhoto";

// A faint copy of the current boat's photo sits behind the whole page.
export const BoatWatermark = ({ boat }) => {
  const [failed, setFailed] = useState(null);
  if (!boat?.photo_v || failed === boat.photo_v) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" data-testid="boat-watermark">
      <img src={photoUrl(boat)} alt="" onError={() => setFailed(boat.photo_v)} className="h-full w-full object-cover opacity-[0.08] grayscale-[30%]" data-testid="boat-watermark-img" />
    </div>
  );
};
