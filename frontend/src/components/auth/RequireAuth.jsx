import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const RequireAuth = ({ children, admin }) => {
  const { user, checking } = useAuth();
  if (!user && checking) {
    return <div className="flex min-h-screen items-center justify-center" data-testid="auth-loading"><Loader2 className="h-8 w-8 animate-spin text-[var(--navy)]" /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !user.is_admin) return <Navigate to="/" replace />;
  return children;
};
