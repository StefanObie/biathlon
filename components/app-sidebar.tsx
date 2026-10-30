"use client";

import Link from "next/link";
import {
  Building2Icon,
  HomeIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";

import { SCREEN_ICON } from "@/components/leagues/screen-icons";
import { Logo } from "@/components/logo";
import {
  LeagueSwitcher,
  OrganizationSwitcher,
} from "@/components/nav-switchers";
import type { HeaderOrganization } from "@/lib/header/header";
import type { NavModel } from "@/lib/navigation/navigation";
import { cn } from "@/lib/utils";

/** The fixed navigation on a laptop: every page but the home page. */
export function AppSidebar({
  model,
  organizations,
  email,
  profileActive,
  onCreateLeague,
}: {
  model: NavModel;
  organizations: HeaderOrganization[];
  email: string | null;
  profileActive: boolean;
  onCreateLeague: () => void;
}) {
  const { header, league } = model;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background text-sm lg:flex">
      <Link href="/" className="flex h-16 shrink-0 items-center gap-2 px-5">
        <Logo size={28} />
        <span className="truncate font-medium">Crossland Biathlon</span>
      </Link>

      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3"
      >
        {header.organization.kind === "text" ? (
          <span className="flex min-h-10 items-center truncate px-2 font-medium">
            {header.organization.label}
          </span>
        ) : (
          <OrganizationSwitcher
            label={header.organization.label}
            organizations={organizations}
            className="w-full"
          />
        )}
        <NavRow
          href={model.organization.href}
          active={model.organization.active}
          icon={Building2Icon}
          label="Organization"
        />

        {league && (
          <>
            <div className="mt-4">
              <LeagueSwitcher
                label={league.label}
                options={league.options}
                canCreate={league.canCreate}
                onCreate={onCreateLeague}
                className="w-full"
              />
            </div>
            <NavRow
              href={league.home.href}
              active={league.home.active}
              icon={HomeIcon}
              label="League home"
            />
            {league.screens.map((screen) => (
              <NavRow
                key={screen.screen}
                href={screen.href}
                active={screen.active}
                icon={SCREEN_ICON[screen.screen]}
                label={screen.label}
              />
            ))}
            {league.settings && (
              <NavRow
                href={league.settings.href}
                active={league.settings.active}
                icon={SettingsIcon}
                label="League settings"
              />
            )}
          </>
        )}
      </nav>

      <div className="shrink-0 border-t p-3">
        <Link
          href="/profile"
          aria-current={profileActive ? "page" : undefined}
          className={cn(
            "flex h-10 items-center gap-2 rounded-md px-2 hover:bg-accent",
            profileActive && "bg-accent font-medium",
          )}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
            {email?.[0] ?? "?"}
          </span>
          <span className="truncate">{email ?? "Profile"}</span>
        </Link>
      </div>
    </aside>
  );
}

function NavRow({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-md px-2 hover:bg-accent hover:text-foreground",
        active ? "bg-accent font-medium" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}
