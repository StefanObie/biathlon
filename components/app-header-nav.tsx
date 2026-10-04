"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import { CreateLeagueForm } from "@/components/leagues/create-league-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  headerModel,
  type HeaderLeague,
  type HeaderOrganization,
} from "@/lib/header/header";
import { leagueAddress } from "@/lib/leagues/address";

const TRIGGER =
  "flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 font-medium hover:bg-accent";

/**
 * The slim one-line header on every signed-in page: Organization switcher,
 * League switcher inside a League, and the avatar linking to Profile.
 */
export function AppHeaderNav({
  organizations,
  leagues,
  remembered,
  email,
}: {
  organizations: HeaderOrganization[];
  leagues: HeaderLeague[];
  remembered: number | null;
  email: string | null;
}) {
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const model = headerModel({ pathname, organizations, leagues, remembered });
  const createFor = model.league
    ? organizations.find((o) => o.id === model.league?.organizationId)
    : undefined;

  return (
    <header className="w-full border-b border-b-foreground/10">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-1 px-3 text-sm">
        {model.organization.kind === "text" ? (
          <span className="min-w-0 truncate px-2 font-medium">
            {model.organization.label}
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger className={TRIGGER}>
              <span className="truncate">{model.organization.label}</span>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
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
        )}

        {model.league && (
          <>
            <span className="text-muted-foreground" aria-hidden>
              /
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger className={TRIGGER}>
                <span className="truncate">{model.league.label}</span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-w-[90vw]">
                {model.league.options.map((league) => (
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
                {model.league.canCreate && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setCreating(true)}>
                      New league
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        <Link
          href="/profile"
          aria-label="Profile"
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase hover:bg-accent"
        >
          {email?.[0] ?? "?"}
        </Link>
      </div>

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
    </header>
  );
}
