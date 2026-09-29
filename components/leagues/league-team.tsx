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
import {
  removeFromTeam,
  setTeamRole,
  type TeamChangeResult,
} from "@/lib/leagues/team-actions";

export interface TeamRow {
  userId: string;
  email: string;
  isAdmin: boolean;
  /** Roles currently held on this League. */
  roles: LeagueRole[];
}

/**
 * The League team, managed by an Admin: every Member of the Organization,
 * with a checkbox per Role. Ticking one adds the Member to the team with
 * that Role; unticking the last one takes them off it. Admins already cover
 * every Role on every League, so they aren't given any here.
 */
export function LeagueTeam({
  leagueId,
  rows,
}: {
  leagueId: number;
  rows: TeamRow[];
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
      <div>
        <h2 className="text-lg font-semibold">Team</h2>
        <p className="text-sm text-muted-foreground">
          Only the Members on this league&apos;s team, and the
          organization&apos;s Admins, can open it. Officials can do everything
          but manage the team; Timekeepers use the Timer screen, Placers the
          Position screen, and Callers the Call room screen.
        </p>
      </div>

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
                            setTeamRole(
                              leagueId,
                              row.userId,
                              role,
                              checked === true,
                            ),
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
                        onClick={() =>
                          run(() => removeFromTeam(leagueId, row.userId))
                        }
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
  );
}
