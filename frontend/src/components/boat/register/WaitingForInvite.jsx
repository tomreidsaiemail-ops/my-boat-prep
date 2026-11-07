import { Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// Shown after registering to someone with no boat of their own: nothing to do until the skipper's crew invite arrives.
export const WaitingForInvite = ({ vessel, skipper }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const close = async () => { await logout(); navigate("/login", { replace: true }); };
  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-white px-6 text-center" data-testid="waiting-invite-screen">
      <Mail className="h-14 w-14 text-[var(--navy)]" />
      <h1 className="font-display text-3xl font-extrabold text-[var(--navy)]">Waiting for your crew invite</h1>
      <p className="max-w-sm text-base leading-relaxed" data-testid="waiting-invite-text">
        Your registration is with the skipper of {vessel || `${skipper}'s boat`}. When your crew invite arrives by email, tap the link in it to join the boat.
      </p>
      <button type="button" className="btn-solid h-16 w-full max-w-sm justify-center text-lg" onClick={close} data-testid="waiting-invite-close-btn">
        Close my registration window
      </button>
    </div>
  );
};
