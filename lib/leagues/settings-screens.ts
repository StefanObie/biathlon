import type { SettingsScreen } from "@/lib/access/roles";

/** Each League settings screen's name, the same in the hub and its nav. */
export const SETTINGS_TITLE: Record<SettingsScreen, string> = {
  team: "League team",
  results: "Visibility",
  "start-list": "Start list",
  swim: "Swim import",
  export: "Export",
};
