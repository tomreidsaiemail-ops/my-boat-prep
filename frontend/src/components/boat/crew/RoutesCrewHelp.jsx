import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { HelpDialog } from "@/components/boat/HelpMenu";
import useAdminLists from "@/hooks/useAdminLists";

const NAME = "admin - help panel - planning routes and inviting crew";

// Admin-editable help: how to plan trips and invite crew (Bulk Quick Reg, Quick Invite), as a Help button beside Add photo.
export const RoutesCrewHelp = ({ online }) => {
  const [open, setOpen] = useState(false);
  const help = useAdminLists("Admin - Help Panel - ", online).find((l) => l.name.toLowerCase().replace(/\s+/g, " ").trim() === NAME)?.items;
  if (!help?.length) return null;
  return (
    <>
      <button type="button" className="btn-ghost flex h-11 items-center gap-2 px-4" onClick={() => setOpen(true)} aria-label="Help: Planning routes and inviting crew" data-testid="routes-crew-help-btn">
        <HelpCircle className="h-4 w-4" /> Help
      </button>
      <HelpDialog help={open ? { title: "Planning routes and inviting crew", items: help } : null} onClose={() => setOpen(false)} />
    </>
  );
};
