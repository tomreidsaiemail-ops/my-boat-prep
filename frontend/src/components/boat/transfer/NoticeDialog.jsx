import { useEffect, useState } from "react";
import { Ship } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";

// In-app messages, e.g. "Kia Ora is now yours"; opening the new boat marks it seen.
export const NoticeDialog = ({ online, onOpenBoat }) => {
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    if (online) api.get("/me/notices").then(({ data }) => setNotices(data.notices)).catch(() => {});
  }, [online]);
  const n = notices[0];
  const done = (open) => {
    api.post(`/me/notices/${n.notice_id}/seen`).catch(() => {});
    setNotices((l) => l.slice(1));
    if (open && n.boat_id) onOpenBoat(n.boat_id);
  };
  return (
    <Dialog open={!!n} onOpenChange={(o) => !o && done(false)}>
      <DialogContent className="max-w-sm border-2 border-[var(--navy)]" data-testid="notice-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><Ship className="h-5 w-5" />{n?.title}</DialogTitle>
          <DialogDescription data-testid="notice-text">{n?.text}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">It comes with no crew, the Ship's Log has crew names hidden, and the Food &amp; Drink cupboards are empty.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost h-11 px-4" onClick={() => done(false)} data-testid="notice-later-btn">Later</button>
          {n?.boat_id && <button type="button" className="btn-solid h-11 px-4" onClick={() => done(true)} data-testid="notice-open-boat-btn">Open the boat</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
