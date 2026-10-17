import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export const MEDIA_LISTS = [
  { id: "sailingYoutube", kind: "youtube", name: "Sailing YouTube Channels", isShared: true, isMedia: true },
  { id: "sailingMovies", kind: "movies", name: "Sailing Movies", isShared: true, isMedia: true },
];
export const mediaLabel = (m) => `${m.name}${m.note ? ` - ${m.note}` : ""} (${m.url})`;

const cacheKey = (kind) => `mbp_media_${kind}`;
const readCache = (kind) => { try { return JSON.parse(localStorage.getItem(cacheKey(kind))) || []; } catch { return []; } };

const useMediaKind = (kind, online) => {
  const [items, setItems] = useState(() => readCache(kind));
  const store = useCallback((next) => { setItems(next); localStorage.setItem(cacheKey(kind), JSON.stringify(next)); }, [kind]);

  useEffect(() => {
    if (!online) return;
    api.get(`/media/${kind}`, { timeout: 10000 }).then(({ data }) => store(data.items)).catch(() => {});
  }, [online, kind, store]);

  const call = useCallback(async (method, path = "", body) => {
    const { data } = await api[method](`/admin/media/${kind}${path}`, body, { timeout: 20000 });
    store(data.items);
  }, [kind, store]);

  return {
    items,
    add: (m) => call("post", "", m),
    edit: (id, m) => call("put", `/${id}`, m),
    remove: (id) => call("delete", `/${id}`),
    reorder: (ids) => call("put", "/order", { ids }),
  };
};

export default function useMedia(online) {
  const youtube = useMediaKind("youtube", online);
  const movies = useMediaKind("movies", online);
  return { sailingYoutube: youtube, sailingMovies: movies };
}
