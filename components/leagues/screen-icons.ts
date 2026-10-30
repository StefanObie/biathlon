import {
  ClipboardCheckIcon,
  FootprintsIcon,
  ListOrderedIcon,
  MedalIcon,
  TimerIcon,
  WavesIcon,
  type LucideIcon,
} from "lucide-react";

import type { HomeTile } from "@/lib/access/roles";

/** One icon per League destination, the same wherever it's linked from. */
export const SCREEN_ICON: Record<HomeTile, LucideIcon> = {
  "call-room": FootprintsIcon,
  "call-room-swim": WavesIcon,
  position: ListOrderedIcon,
  timer: TimerIcon,
  reconcile: ClipboardCheckIcon,
  medals: MedalIcon,
};
