"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { AppHeaderNav } from "@/components/app-header-nav";
import { AppSidebar } from "@/components/app-sidebar";
import { CreateLeagueForm } from "@/components/leagues/create-league-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HeaderLeague, HeaderOrganization } from "@/lib/header/header";
import {
  isHeatScreen,
  navModel,
  type NavTeamEntry,
} from "@/lib/navigation/navigation";

/** Every signed-in page's fixed navigation: top header and bottom bar on a
 * phone, sidebar from `lg`. */
export function AppNavigation({
  organizations,
  leagues,
  team,
  remembered,
  today,
  email,
}: {
  organizations: HeaderOrganization[];
  leagues: HeaderLeague[];
  team: NavTeamEntry[];
  remembered: number | null;
  today: string;
  email: string | null;
}) {
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const model = navModel({
    pathname,
    organizations,
    leagues,
    team,
    remembered,
    today,
  });
  const createFor = organizations.find(
    (o) => o.id === model.league?.organizationId,
  );
  const onCreateLeague = () => setCreating(true);

  return (
    <>
      <AppHeaderNav
        model={model}
        organizations={organizations}
        email={email}
        onCreateLeague={onCreateLeague}
      />
      <AppSidebar
        model={model}
        organizations={organizations}
        email={email}
        profileActive={pathname === "/profile"}
        onCreateLeague={onCreateLeague}
      />
      <AppBottomNav model={model} />

      {createFor && (
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New league in {createFor.name}</DialogTitle>
            </DialogHeader>
            <CreateLeagueForm organizations={[createFor]} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** Room at the end of a page for the phone's bottom bar. A per-heat screen
 * makes its own room for its own bar. */
export function BottomNavSpacer() {
  const pathname = usePathname();
  if (isHeatScreen(pathname)) return null;
  return (
    <div
      aria-hidden
      className="h-[calc(5rem+env(safe-area-inset-bottom))] shrink-0 lg:hidden"
    />
  );
}
