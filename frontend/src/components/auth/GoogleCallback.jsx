import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const OAUTH_STATE_KEY = "mbp_oauth_state";

export const GoogleCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const code = params.get("code");
    const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    const fail = (msg) => { setTimeout(() => toast.error(msg), 0); navigate("/login", { replace: true }); };
    if (params.get("error")) return fail("Google sign-in was cancelled");
    if (!code || !expected || params.get("state") !== expected) return fail("Sign-in expired, please try again");
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    api.post("/auth/google", { code, redirect_uri: `${window.location.origin}/auth/google` })
      .then(({ data }) => { setUser(data); navigate("/", { replace: true }); })
      .catch((e) => fail(e.response?.data?.detail || "Sign-in failed, please try again"));
  }, [params, navigate, setUser]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-sm font-bold text-[var(--muted)]" data-testid="google-callback">
      <Loader2 className="h-5 w-5 animate-spin" /> Signing you in...
    </div>
  );
};
