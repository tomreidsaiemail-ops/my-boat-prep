// Where a boat area or its items can go: its own folders and boxes first, then its zone, then the other zones in rainbow order.
export const groupTargets = (source, list, zones, folders = []) => {
  const cur = zones[source?.id]?.colour || "";
  const byZone = new Map();
  list.filter((a) => !folders.some((f) => f.id === a.id)).forEach((a) => {
    const z = zones[a.id];
    const k = z ? z.colour : "";
    if (!byZone.has(k)) byZone.set(k, { key: k || "none", zone: z || null, items: [] });
    byZone.get(k).items.push(a);
  });
  const rank = (g) => (g.zone ? g.zone.rank : 99);
  const zoneGroups = [...byZone.entries()].sort(([ka, a], [kb, b]) => (kb === cur) - (ka === cur) || rank(a) - rank(b))
    .map(([k, g]) => ({ ...g, current: k === cur, label: `${g.zone ? g.zone.map : "Not in a zone"}${k === cur && cur ? " (this zone)" : ""}` }));
  return folders.length ? [{ key: "folders", label: `Folders and boxes in ${source.name}`, items: folders, folders: true }, ...zoneGroups] : zoneGroups;
};

export const TargetOptions = ({ groups }) => groups.map((g) => (
  <optgroup key={g.key} label={g.label}>
    {g.items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
  </optgroup>
));
