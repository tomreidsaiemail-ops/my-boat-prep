import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const sessionId = new URLSearchParams(location.hash.slice(1)).get("session_id");
    api.post("/auth/session", null, { headers: { "X-Session-ID": sessionId } })
      .then(({ data }) => { setUser(data); navigate("/", { replace: true, state: { user: data } }); })
      .catch(() => { toast.error("Sign-in failed, please try again"); navigate("/login", { replace: true }); });
  }, [location.hash, navigate, setUser]);

  return null;
};
