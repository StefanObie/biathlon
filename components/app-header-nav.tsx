"use client";

import Link from "next/link";

import {
  LeagueSwitcher,
  OrganizationSwitcher,
} from "@/components/nav-switchers";
import type { HeaderOrganization } from "@/lib/header/header";
import type { NavModel } from "@/lib/navigation/navigation";

/**
 * The slim one-line header on a phone: Organization switcher, League switcher
 * inside a League, and the avatar linking to Profile. From `lg` the sidebar
 * has all of these.
 */
export function AppHeaderNav({
  model,
  organizations,
  email,
  onCreateLeague,
}: {
  model: NavModel;
  organizations: HeaderOrganization[];
  email: string | null;
  onCreateLeague: () => void;
}) {
  const { header } = model;

  return (
    <header className="w-full border-b lg:hidden">
      <div className="flex h-14 w-full items-center gap-1 px-3 text-sm">
        {header.organization.kind === "text" ? (
          <span className="min-w-0 truncate px-2 font-medium">
            {header.organization.label}
          </span>
        ) : (
          <OrganizationSwitcher
            label={header.organization.label}
            organizations={organizations}
          />
        )}

        {header.league && (
          <>
            <span className="text-muted-foreground" aria-hidden>
              /
            </span>
            <LeagueSwitcher
              label={header.league.label}
              options={header.league.options}
              canCreate={header.league.canCreate}
              onCreate={onCreateLeague}
            />
          </>
        )}

        <Link
          href="/profile"
          aria-label="Profile"
          className="ml-auto flex size-11 shrink-0 items-center justify-center"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
            {email?.[0] ?? "?"}
          </span>
        </Link>
      </div>
    </header>
  );
}
