import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { UpgradeProvider } from "@/context/UpgradeContext";
import { GoogleCallback } from "@/components/auth/GoogleCallback";
import { RequireAuth } from "@/components/auth/RequireAuth";
import BoatShell from "@/pages/BoatShell";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import AdminTemplates from "@/pages/AdminTemplates";
import AdminPromos from "@/pages/AdminPromos";
import AdminAnalytics from "@/pages/AdminAnalytics";
import PaymentResult from "@/pages/PaymentResult";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordReset";
import Terms from "@/pages/Terms";
import JoinCrew, { JOIN_KEY } from "@/pages/JoinCrew";
import ShoreWatch from "@/pages/ShoreWatch";
import { readPick } from "@/lib/shorePick";
import ShoreJoin, { SHORE_JOIN_KEY } from "@/pages/ShoreJoin";
import { TermsGate } from "@/components/auth/TermsGate";
import { MagicLimitDialog } from "@/components/boat/MagicLimitDialog";
import { AdminModeStrip } from "@/components/auth/AdminModeStrip";
import { UpdateGuard } from "@/components/auth/UpdateGuard";
import { captureQr } from "@/lib/qrScan";

captureQr();

// Remount the boat workspace per account so one user's local data never carries into another's.
function UserBoat() {
  const { user } = useAuth();
  const shoreToken = localStorage.getItem(SHORE_JOIN_KEY);
  if (shoreToken) return <Navigate to={`/shore/join/${shoreToken}`} replace />;
  // Shore contacts choose a boat once per sign-in on /shore; shore-only users never see the boat app. A crew invite still goes through.
  const visiting = !user.shore_only && readPick(user.user_id) === "app";
  if ((user.shore_only || user.home === "shore" || user.shore_contact) && !visiting && !localStorage.getItem(JOIN_KEY)) return <Navigate to="/shore" replace />;
  return <TermsGate key={user.user_id}><BoatShell /></TermsGate>;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/google" element={<GoogleCallback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/join/:token" element={<JoinCrew />} />
      <Route path="/shore/join/:token" element={<ShoreJoin />} />
      <Route path="/shore" element={<RequireAuth><ShoreWatch /></RequireAuth>} />
      <Route path="/" element={<RequireAuth><UserBoat /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
      <Route path="/admin/templates" element={<RequireAuth admin><AdminTemplates /></RequireAuth>} />
      <Route path="/admin/promos" element={<RequireAuth admin><AdminPromos /></RequireAuth>} />
      <Route path="/admin/analytics" element={<RequireAuth admin><AdminAnalytics /></RequireAuth>} />
      <Route path="/payment/success" element={<RequireAuth><PaymentResult success /></RequireAuth>} />
      <Route path="/payment/cancel" element={<RequireAuth><PaymentResult /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <UpgradeProvider>
            <AdminModeStrip />
            <UpdateGuard />
            <AppRouter />
            <MagicLimitDialog />
          </UpgradeProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="bottom-center" richColors style={{ pointerEvents: "auto" }} />
    </div>
  );
}

export default App;
