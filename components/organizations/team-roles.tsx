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
 * A team managed by an Admin — a League team or the Default team: every
 * Member of the Organization, with a checkbox per Role. Ticking one gives
 * the Member that Role on the team; unticking the last one takes them off
 * it. Admins already cover every Role on every League, so they aren't given
 * any here.
 */
export function TeamRoles({
  title,
  description,
  rows,
  setRole,
  remove,
}: {
  title: string;
  description: React.ReactNode;
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
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
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
                          run(() => setRole(row.userId, role, checked === true))
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
  );
}
