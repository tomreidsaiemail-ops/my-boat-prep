import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { UpgradeProvider } from "@/context/UpgradeContext";
import { GoogleCallback } from "@/components/auth/GoogleCallback";
import { RequireAuth } from "@/components/auth/RequireAuth";
import BoatPrep from "@/pages/BoatPrep";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import PaymentResult from "@/pages/PaymentResult";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordReset";
import Terms from "@/pages/Terms";
import { TermsGate } from "@/components/auth/TermsGate";

// Remount the boat workspace per account so one user's local data never carries into another's.
function UserBoat() {
  const { user } = useAuth();
  return <TermsGate key={user.user_id}><BoatPrep /></TermsGate>;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/google" element={<GoogleCallback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/" element={<RequireAuth><UserBoat /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
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
            <AppRouter />
          </UpgradeProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}

export default App;
