import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PICK_KEY } from "@/lib/shorePick";
import { clearFirstTime } from "@/lib/firstTime";

const USER_KEY = "mbp_user";
const FIRST_KEY = "mbp_first_time_checked";
const AuthContext = createContext(null);

const cachedUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(cachedUser);
  const [checking, setChecking] = useState(true);

  const setUser = useCallback((u) => {
    setUserState(u);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me", { timeout: 8000 });
      setUser(data);
      return data;
    } catch (e) {
      if (e.response?.status === 401) setUser(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, [setUser]);

  // Once per app open: someone tagged "Behave Like First Time" starts again as a first-timer (the server says if they are).
  const uid = user?.user_id;
  useEffect(() => {
    if (checking || !uid || sessionStorage.getItem(FIRST_KEY) === uid) return;
    api.post("/me/first-time-reset", null, { timeout: 20000 }).then(({ data }) => {
      sessionStorage.setItem(FIRST_KEY, uid);
      if (data.reset) { clearFirstTime(); window.location.reload(); }
    }).catch(() => {});
  }, [checking, uid]);

  useEffect(() => {
    // Returning from Google sign-in: GoogleCallback exchanges the code first.
    if (window.location.pathname === "/auth/google") { setChecking(false); return; }
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* offline: still sign out locally */ }
    localStorage.removeItem("mbp_add_area_tip");
    localStorage.removeItem(PICK_KEY);
    localStorage.removeItem("mbp_invites_later");
    sessionStorage.removeItem("mbp_invites_later");
    ["mbp_welcome_checked", "mbp_welcome_go", "mbp_session_boat"].forEach((k) => sessionStorage.removeItem(k));
    setUser(null);
  }, [setUser]);

  return <AuthContext.Provider value={{ user, checking, setUser, refresh, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
