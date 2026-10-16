import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const USER_KEY = "mbp_user";
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

  useEffect(() => {
    // Returning from Google sign-in: GoogleCallback exchanges the code first.
    if (window.location.pathname === "/auth/google") { setChecking(false); return; }
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* offline: still sign out locally */ }
    setUser(null);
  }, [setUser]);

  return <AuthContext.Provider value={{ user, checking, setUser, refresh, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
