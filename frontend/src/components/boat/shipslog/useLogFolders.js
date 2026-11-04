import { useState } from "react";
import { toast } from "sonner";
import { LogFolderRow } from "@/components/boat/shipslog/LogFolderRow";
import { arrangeLog, isInside, setAllOpen, ungroup } from "@/lib/logFolders";

// Ship's Log folder view; crew open and close folders on their own device only.
export default function useLogFolders({ items, setItems, guard, crew, onEdit }) {
  const [local, setLocal] = useState({});
  const view = crew ? items.map((i) => (i.folder && i.id in local ? { ...i, open: local[i.id] } : i)) : items;
  const { rows, counts } = arrangeLog(view);
  const depth = Object.fromEntries(rows.map((r) => [r.item.id, r.depth]));
  const folders = view.filter((i) => i.folder);
  const shownFolders = rows.filter((r) => !r.hidden && r.item.folder).map((r) => r.item);
  const logsIn = (id) => rows.filter((r) => !r.item.folder && isInside(view, r.item, id)).length;
  const setOpen = (id, open) => (crew ? setLocal((l) => ({ ...l, [id]: open })) : setItems((list) => list.map((i) => (i.id === id ? { ...i, open } : i))));
  const setAll = (open) => (crew ? setLocal(Object.fromEntries(folders.map((f) => [f.id, open]))) : setItems((list) => setAllOpen(list, open)));
  const unfold = (item) => {
    if (!guard()) return;
    const before = items;
    setItems((list) => ungroup(list, item.id));
    toast(`Ungrouped "${item.label}"`, { duration: 6000, action: { label: "Undo", onClick: () => setItems(() => before) } });
  };
  const folderRow = (item) => (
    <LogFolderRow key={item.id} item={item} depth={depth[item.id] || 0} count={counts[item.id] || 0} logs={item.folder === "year" ? logsIn(item.id) : null} readOnly={crew}
      onOpen={(o) => setOpen(item.id, o)} onEdit={() => onEdit(item)} onUngroup={() => unfold(item)} />
  );
  return { visible: rows.filter((r) => !r.hidden).map((r) => r.item), depthOf: (id) => depth[id] || 0, folderRow, hasFolders: folders.length > 0, anyOpen: shownFolders.some((f) => f.open), setAll };
}
