"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LEAGUE_ROLES, ROLE_LABEL, type LeagueRole } from "@/lib/access/roles";
import type { TeamChangeResult, TeamRow } from "@/lib/organizations/team-rows";

/**
 * A team managed by an Admin — a League team or the Default team: the Members
 * in `rows`, with a checkbox per Role. Ticking one gives the Member that Role
 * on the team; unticking the last one takes them off it. Admins already cover
 * every Role on every League, so they aren't given any here.
 */
export function TeamRoles({
  title,
  description,
  action,
  rows,
  setRole,
  remove,
}: {
  title: string;
  description: React.ReactNode;
  /** Beside the title on a laptop, in its own row on a phone. */
  action?: React.ReactNode;
  rows: TeamRow[];
  setRole: (
    userId: string,
    role: LeagueRole,
    held: boolean,
  ) => Promise<TeamChangeResult>;
  remove: (userId: string) => Promise<TeamChangeResult>;
}) {
  const [isPending, startTransition] = useTransition();

  function run(change: () => Promise<TeamChangeResult>) {
    startTransition(async () => {
      const { error } = await change();
      if (error) toast.error(error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>

      {/* A table of five columns doesn't fit a phone, so each Member stacks. */}
      <ul className="divide-y rounded-lg border sm:hidden">
        {rows.map((row) => (
          <li key={row.userId} className="flex flex-col gap-2 p-4">
            <div className="flex min-h-8 items-center justify-between gap-2">
              <span className="min-w-0 break-words font-medium">
                {row.email}
              </span>
              {!row.isAdmin && row.roles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  disabled={isPending}
                  onClick={() => run(() => remove(row.userId))}
                >
                  Remove
                </Button>
              )}
            </div>
            {row.isAdmin ? (
              <Badge variant="secondary" className="self-start">
                Admin: every Role
              </Badge>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {LEAGUE_ROLES.map((role) => (
                  <label
                    key={role}
                    className="flex min-h-11 items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={row.roles.includes(role)}
                      disabled={isPending}
                      onCheckedChange={(checked) =>
                        run(() => setRole(row.userId, role, checked === true))
                      }
                    />
                    {ROLE_LABEL[role]}
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              {LEAGUE_ROLES.map((role) => (
                <TableHead key={role} className="text-center">
                  {ROLE_LABEL[role]}
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell className="font-medium">{row.email}</TableCell>
                {row.isAdmin ? (
                  <TableCell colSpan={LEAGUE_ROLES.length + 1}>
                    <Badge variant="secondary">Admin: every Role</Badge>
                  </TableCell>
                ) : (
                  <>
                    {LEAGUE_ROLES.map((role) => (
                      <TableCell key={role} className="text-center">
                        <Checkbox
                          aria-label={`${ROLE_LABEL[role]}: ${row.email}`}
                          checked={row.roles.includes(role)}
                          disabled={isPending}
                          onCheckedChange={(checked) =>
                            run(() =>
                              setRole(row.userId, role, checked === true),
                            )
                          }
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {row.roles.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => run(() => remove(row.userId))}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
