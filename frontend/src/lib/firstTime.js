import { outboxKey, stateKey } from "@/hooks/useBoatStore";

// "Behave Like First Time": the help, tips, guides and walkthrough progress kept on this device, plus the old Model Vessel copy.
const HELP = ["mbp_add_area_tip", "mbp_batch_area_help_seen", "mbp_batch_help_closed", "mbp_electrical_help_hidden", "mbp_engine_help_hidden",
  "mbp_help_bartender", "mbp_help_fish", "mbp_inventory_instructions_collapsed", "mbp_log_group_help_seen", "mbp_log_help_hidden", "mbp_magic_nudge",
  "mbp_newlist_help_seen", "mbp_routes_crew_help_seen", "mbp_todo_help_hidden", "mbp_wizard_pending", "mbp_zone_map_help_seen", "mbp_shore_alert_hidden",
  stateKey("model_vessel"), outboxKey("model_vessel")];
const PREFIXES = ["mbp_cupboard_coach:", "mbp_model_", "mbp_onboard_", "mbp_training_progress:", "mbp_trip_guide:", "mbp_wizard_opened:",
  "mbp_wizards_done:", "mbp_walk_missing_hidden_", "mbp_route_map_warned:", "mbp_zone_help:"];
const SESSION = ["mbp_welcome_checked", "mbp_welcome_go", "mbp_session_boat"];

export const clearFirstTime = () => {
  Object.keys(localStorage).filter((k) => HELP.includes(k) || PREFIXES.some((p) => k.startsWith(p)) || /^mbp_.+_hidden_until$/.test(k))
    .forEach((k) => localStorage.removeItem(k));
  SESSION.forEach((k) => sessionStorage.removeItem(k));
};
