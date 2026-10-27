import { api } from "@/lib/api";
import { mediaLabel } from "@/hooks/useMedia";

const fixUrl = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const withThumb = async (m, online, old) => {
  if (old && old.url === fixUrl(m.url) && old.thumbnail) return { ...m, url: old.url, thumbnail: old.thumbnail };
  if (!online) {
    if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(fixUrl(m.url))) throw new Error("Please enter a valid web link");
    return { ...m, url: fixUrl(m.url), thumbnail: null };
  }
  const { data } = await api.post("/media/thumbnail", { url: m.url }, { timeout: 20000 });
  return { ...m, url: data.url, thumbnail: data.thumbnail };
};

const unique = (items, name, exceptId) => {
  if (items.some((i) => i.id !== exceptId && (i.name || "").toLowerCase() === name.toLowerCase())) throw new Error(`${name} already exists`);
};

// A skipper's own cloned YouTube/Movies list, stored on the boat so it works offline.
export const ownMediaStore = (items, online, setItems) => ({
  items,
  add: async (m) => {
    unique(items, m.name);
    const full = await withThumb(m, online);
    setItems((list) => [...list, { id: `m_${Date.now()}`, ...full, label: mediaLabel(full), checked: false }]);
  },
  edit: async (id, m) => {
    unique(items, m.name, id);
    const full = await withThumb(m, online, items.find((i) => i.id === id));
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...full, label: mediaLabel(full) } : i)));
  },
  remove: async (id) => setItems((list) => list.filter((i) => i.id !== id)),
  reorder: async (ids) => setItems((list) => ids.map((id) => list.find((i) => i.id === id)).filter(Boolean)),
});

export const toOwnMedia = (m) => ({ id: m.id, name: m.name, url: m.url, note: m.note || "", thumbnail: m.thumbnail || null, label: mediaLabel(m), checked: false });
