"use client";

import { useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { InviteForm } from "@/components/invitations/invite-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { LEAGUE_ROLES, ROLE_LABEL, type LeagueRole } from "@/lib/access/roles";
import type { TeamChangeResult } from "@/lib/organizations/team-rows";

/**
 * Adds someone to one League's team: a Member of the Organization who isn't on
 * it yet, or anyone else by invitation to this League.
 */
export function AddTeamMember({
  organizationId,
  league,
  candidates,
  setRole,
}: {
  organizationId: number;
  league: { id: number; name: string };
  /** The Organization's Members not on this League's team. */
  candidates: { userId: string; email: string }[];
  setRole: (
    userId: string,
    role: LeagueRole,
    held: boolean,
  ) => Promise<TeamChangeResult>;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [roles, setRoles] = useState<LeagueRole[]>([]);
  const [isPending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      for (const role of roles) {
        const { error } = await setRole(userId, role, true);
        if (error) {
          toast.error(error);
          return;
        }
      }
      setUserId("");
      setRoles([]);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 w-full shrink-0 sm:h-9 sm:w-auto">
          <PlusIcon aria-hidden />
          Add team member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add team member to {league.name}</DialogTitle>
        </DialogHeader>

        {candidates.length > 0 && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="member">Member</FieldLabel>
              <select
                id="member"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="" disabled>
                  Choose a Member
                </option>
                {candidates.map((candidate) => (
                  <option key={candidate.userId} value={candidate.userId}>
                    {candidate.email}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Roles</legend>
              <div className="grid grid-cols-2 gap-1">
                {LEAGUE_ROLES.map((role) => (
                  <label
                    key={role}
                    className="flex min-h-11 items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={roles.includes(role)}
                      onCheckedChange={(checked) =>
                        setRoles((current) =>
                          checked === true
                            ? [...current, role]
                            : current.filter((r) => r !== role),
                        )
                      }
                    />
                    {ROLE_LABEL[role]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button
              onClick={add}
              disabled={isPending || !userId || roles.length === 0}
            >
              {isPending ? "Adding…" : "Add to team"}
            </Button>
          </FieldGroup>
        )}

        <section
          className={
            candidates.length > 0
              ? "flex flex-col gap-3 border-t pt-4"
              : "flex flex-col gap-3"
          }
        >
          <h3 className="text-sm font-medium">Invite someone new</h3>
          <InviteForm organizationId={organizationId} league={league} />
        </section>
      </DialogContent>
    </Dialog>
  );
}
