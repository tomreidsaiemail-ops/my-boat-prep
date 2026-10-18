import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const JOIN_KEY = "mbp_join_token";

export default function JoinCrew() {
  const { token } = useParams();
  const { user, checking } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const tried = useRef(false);

  useEffect(() => {
    if (checking || !user || tried.current) return;
    tried.current = true;
    localStorage.removeItem(JOIN_KEY);
    api.post("/crew/join", { token }).then(({ data }) => {
      localStorage.setItem("mbp_boats_active", data.key);
      toast.success("Welcome aboard! The boat is now in your boat picker");
      navigate("/", { replace: true });
    }).catch((e) => setError(apiError(e, "Couldn't accept the invite")));
  }, [checking, user, token, navigate]);

  if (!checking && !user) {
    localStorage.setItem(JOIN_KEY, token);
    toast.message("Sign in to accept your crew invite");
    return <Navigate to="/login" replace />;
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center" data-testid="join-crew-page">
      {error ? (
        <>
          <p className="text-base font-bold text-[var(--red)]" data-testid="join-crew-error">{error}</p>
          <Link to="/" className="btn-solid px-6" data-testid="join-crew-home-btn">Go to My Boat Prep</Link>
        </>
      ) : <><Loader2 className="h-8 w-8 animate-spin text-[var(--navy)]" /><p>Joining the crew...</p></>}
    </main>
  );
}
