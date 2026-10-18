import BoatPrep from "@/pages/BoatPrep";
import useBoats from "@/hooks/useBoats";
import { useAuth } from "@/context/AuthContext";

export default function BoatShell() {
  const { user } = useAuth();
  const boats = useBoats(user.user_id);
  return <BoatPrep key={boats.activeId} boatId={boats.activeId} boats={boats} />;
}
