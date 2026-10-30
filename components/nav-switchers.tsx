"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HeaderLeague, HeaderOrganization } from "@/lib/header/header";
import { leagueAddress } from "@/lib/leagues/address";
import { cn } from "@/lib/utils";

const TRIGGER =
  "flex min-h-11 min-w-0 items-center gap-1 rounded-md px-2 font-medium hover:bg-accent lg:min-h-10";

/** Switches Organization, and leads to creating one or to the home page. */
export function OrganizationSwitcher({
  label,
  organizations,
  className,
}: {
  label: string;
  organizations: HeaderOrganization[];
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(TRIGGER, className)}>
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[90vw]">
        {organizations.map((organization) => (
          <DropdownMenuItem key={organization.id} asChild>
            <Link href={`/organizations/${organization.id}`}>
              <span className="truncate">{organization.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {organizations.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem asChild>
          <Link href="/organizations/new">Create organization</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/">Home</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Switches League within an Organization, and offers an Admin a new one. */
export function LeagueSwitcher({
  label,
  options,
  canCreate,
  onCreate,
  className,
}: {
  label: string;
  options: HeaderLeague[];
  canCreate: boolean;
  onCreate: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(TRIGGER, className)}>
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[90vw]">
        {options.map((league) => (
          <DropdownMenuItem key={league.id} asChild>
            <Link
              href={leagueAddress({
                organizationId: league.organizationId,
                leagueId: league.id,
              })}
            >
              <span className="truncate">{league.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {canCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCreate}>New league</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
