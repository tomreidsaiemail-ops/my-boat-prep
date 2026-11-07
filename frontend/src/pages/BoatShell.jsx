import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BoatPrep from "@/pages/BoatPrep";
import useBoats from "@/hooks/useBoats";
import { useAuth } from "@/context/AuthContext";
import { JOIN_KEY } from "@/pages/JoinCrew";
import { PendingInvitePrompt } from "@/components/boat/PendingInvitePrompt";
import { CrewRegistrationPrompt } from "@/components/boat/register/CrewRegistrationPrompt";
import { toast } from "sonner";
import { clearQr, pendingQr, qrBoatKey } from "@/lib/qrScan";

export default function BoatShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const boats = useBoats(user.user_id);
  useEffect(() => {
    const token = localStorage.getItem(JOIN_KEY);
    if (token) navigate(`/join/${token}`, { replace: true });
  }, [navigate]);
  // A scanned cupboard QR card: switch to that boat first, then Boat Inventory opens the Magic Scan.
  useEffect(() => {
    const q = pendingQr();
    if (!q) return;
    const key = qrBoatKey(q, user.user_id);
    if (key === boats.activeId) return;
    if (boats.boats.some((b) => b.key === key)) boats.select(key);
    else { clearQr(); toast.error("That QR card is for a boat that isn't on this phone. Ask the skipper to invite you as crew."); }
  }, [boats.boats, boats.activeId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <BoatPrep key={boats.activeId} boatId={boats.activeId} boats={boats} />
      <PendingInvitePrompt boats={boats} />
      <CrewRegistrationPrompt />
    </>
  );
}
