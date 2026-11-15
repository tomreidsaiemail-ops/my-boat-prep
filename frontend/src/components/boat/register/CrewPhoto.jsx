import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
import { api, API, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";
import { useAuth } from "@/context/AuthContext";

export const crewPhotoUrl = (userId, v) => (userId && v ? `${API}/crew-photo/${userId}?v=${encodeURIComponent(v)}` : "");

// Round photo on a crew card, or nothing if they haven't added one.
export const CrewAvatar = ({ userId, v, name = "", size = "h-10 w-10", testId }) => {
  const [failed, setFailed] = useState(false);
  const src = crewPhotoUrl(userId, v);
  if (!src || failed) return null;
  return <img src={src} alt={name ? `${name}` : "Crew member"} onError={() => setFailed(true)} className={`${size} shrink-0 rounded-full border-2 border-[var(--navy)] object-cover`} data-testid={testId} />;
};

// Crew registration: a photo of yourself, uploaded straight away. Optional, but encouraged.
export const CrewPhotoField = () => {
  const { user } = useAuth();
  const input = useRef(null);
  const [v, setV] = useState("start");
  const [shown, setShown] = useState(true);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let blob;
    try { blob = await shrink(file, 800); } catch { toast.error("That file doesn't look like a picture"); return; }
    const form = new FormData();
    form.append("file", blob, "me.jpg");
    setBusy(true);
    try { const { data } = await api.post("/crew-photo", form, { timeout: 60000 }); setV(data.photo_v); setShown(true); toast.success("Photo added"); }
    catch (err) { toast.error(apiError(err, "Couldn't save your photo")); } finally { setBusy(false); }
  };
  const remove = async () => {
    try { await api.delete("/crew-photo"); setShown(false); } catch (err) { toast.error(apiError(err, "Couldn't remove your photo")); }
  };
  const src = shown ? crewPhotoUrl(user?.user_id, v) : "";
  return (
    <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-[var(--navy)] bg-sky-50 p-3" data-no-dirty data-testid="crew-photo-field">
      {src ? <img src={src} alt="You" onError={() => setShown(false)} className="h-16 w-16 shrink-0 rounded-full border-2 border-[var(--navy)] object-cover" data-testid="crew-photo-preview" />
        : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-[var(--muted)]"><UserRound className="h-8 w-8" /></span>}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm font-bold" data-testid="crew-photo-hint">Add a photo of yourself so the skipper and crew can recognise you on the dock.</p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-10 flex-1 justify-center px-3 text-sm" disabled={busy} onClick={() => input.current?.click()} data-testid="crew-photo-add-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {src ? "Change photo" : "Add my photo"}
          </button>
          {src && <button type="button" className="btn-ghost h-10 px-3 text-sm hover:text-[var(--red)]" onClick={remove} aria-label="Remove my photo" data-testid="crew-photo-remove-btn"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="crew-photo-input" />
    </div>
  );
};
