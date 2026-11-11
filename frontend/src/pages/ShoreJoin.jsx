import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const SHORE_JOIN_KEY = "mbp_shore_join_token";

// Accepts a Shore Contact invite, then opens the Shore Contact Monitoring page.
export default function ShoreJoin() {
  const { token } = useParams();
  const { user, checking, refresh } = useAuth();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    if (checking || user) return;
    localStorage.setItem(SHORE_JOIN_KEY, token);
    toast.message("Sign in to become the boat's shore contact", { id: "shore-signin" });
  }, [checking, user, token]);

  useEffect(() => {
    if (checking || !user || tried.current) return;
    tried.current = true;
    localStorage.removeItem(SHORE_JOIN_KEY);
    api.post("/shore/join", { token }).then(async () => {
      await refresh?.();
      toast.success("You're now a shore contact");
      setDone(true);
    }).catch((e) => setError(apiError(e, "Couldn't accept the invite")));
  }, [checking, user, token, refresh]);

  if (!checking && !user) return <Navigate to="/login" replace />;
  if (done) return <Navigate to="/shore" replace />;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center" data-testid="shore-join-page">
      {error ? (
        <>
          <p className="text-base font-bold text-[var(--red)]" data-testid="shore-join-error">{error}</p>
          <Link to="/shore" className="btn-solid px-6" data-testid="shore-join-home-btn">Go to the shore contact page</Link>
        </>
      ) : <><Loader2 className="h-8 w-8 animate-spin text-[var(--navy)]" /><p>Setting you up as shore contact...</p></>}
    </main>
  );
}
