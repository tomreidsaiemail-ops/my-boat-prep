import { HelpPanel } from "@/components/boat/HelpPanel";
import { LinkedText } from "@/components/boat/LinkedText";
import useAdminLists from "@/hooks/useAdminLists";

const NAME = "admin - help panel - planning routes and inviting crew";

// Admin-editable help: how to plan trips and invite crew (Bulk Quick Reg, Quick Invite).
export const RoutesCrewHelp = ({ online }) => {
  const help = useAdminLists("Admin - Help Panel - ", online).find((l) => l.name.toLowerCase().replace(/\s+/g, " ").trim() === NAME)?.items;
  if (!help?.length) return null;
  return (
    <HelpPanel storageKey="mbp_routes_crew_help_seen" title="Planning routes and inviting crew" testId="routes-crew-help">
      {help.map((i, k) => <p key={k} data-testid={`routes-crew-help-line-${k}`}><LinkedText text={i.label} testId={`routes-crew-help-link-${k}`} /></p>)}
    </HelpPanel>
  );
};
