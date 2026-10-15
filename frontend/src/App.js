import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { UpgradeProvider } from "@/context/UpgradeContext";
import { AuthCallback } from "@/components/auth/AuthCallback";
import { RequireAuth } from "@/components/auth/RequireAuth";
import BoatPrep from "@/pages/BoatPrep";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import PaymentResult from "@/pages/PaymentResult";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><BoatPrep /></RequireAuth>} />
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
