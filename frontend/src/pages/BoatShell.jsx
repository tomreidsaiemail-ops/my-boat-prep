import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BoatPrep from "@/pages/BoatPrep";
import useBoats from "@/hooks/useBoats";
import { useAuth } from "@/context/AuthContext";
import { JOIN_KEY } from "@/pages/JoinCrew";
import { PendingInvitePrompt } from "@/components/boat/PendingInvitePrompt";

export default function BoatShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const boats = useBoats(user.user_id);
  useEffect(() => {
    const token = localStorage.getItem(JOIN_KEY);
    if (token) navigate(`/join/${token}`, { replace: true });
  }, [navigate]);
  return (
    <>
      <BoatPrep key={boats.activeId} boatId={boats.activeId} boats={boats} />
      <PendingInvitePrompt boats={boats} />
    </>
  );
}
