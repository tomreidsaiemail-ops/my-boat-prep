import { toast } from "sonner";
import { api } from "@/lib/api";

// Downloads a crew member's Boat Terms and Conditions Agreement as a PDF.
export const downloadAgreement = async ({ ownerId, boatId, memberId, name }) => {
  try {
    const { data } = await api.get("/crew/agreement/pdf", { params: { boat_id: boatId, ...(ownerId ? { owner_id: ownerId } : {}), ...(memberId ? { member_id: memberId } : {}) }, responseType: "blob", timeout: 30000 });
    const url = URL.createObjectURL(data);
    const a = Object.assign(document.createElement("a"), { href: url, download: `Boat Agreement - ${name || "Crew"}.pdf` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch {
    toast.error("Couldn't create the agreement PDF. Please try again.");
    return false;
  }
};
