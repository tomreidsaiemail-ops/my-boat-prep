import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

// Naming a map "Saloon" etc gives it the admin's predetermined colour, unless the skipper picked one.
export const MapNameField = ({ boat, map, online, onMaps }) => {
  const [name, setName] = useState(map.name || "");
  useEffect(() => setName(map.name || ""), [map.name]);
  const save = async () => {
    const next = name.trim();
    if (next === (map.name || "")) return;
    if (!online) { toast.error("You need a signal to name a zone map"); setName(map.name || ""); return; }
    try {
      const { data } = await api.put(`/boats/${boat.boat_id}/zone-maps/${map.id}/meta`, { name: next });
      onMaps(data.zone_maps);
      const now = data.zone_maps.find((m) => m.id === map.id);
      toast.success(now && now.colour !== map.colour ? `Zone map named ${next} and coloured ${now.colour}` : next ? `Zone map named ${next}` : "Zone map name cleared");
    } catch (e) { toast.error(apiError(e, "Couldn't save the name")); setName(map.name || ""); }
  };
  return (
    <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder="Name this map, e.g. Saloon" aria-label="Zone map name" className="field-input h-9 min-w-0 flex-1 basis-full text-sm normal-case tracking-normal"
      data-testid={`boat-zone-map-name-${map.id}`} />
  );
};
