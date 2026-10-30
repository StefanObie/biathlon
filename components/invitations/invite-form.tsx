"use client";

import { useActionState } from "react";

import { LEAGUE_ROLES, ROLE_LABEL } from "@/lib/access/roles";
import {
  sendInvitation,
  type SendInvitationState,
} from "@/lib/invitations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const initialState: SendInvitationState = {};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs";

export function InviteForm({
  organizationId,
  leagues = [],
  league,
}: {
  organizationId: number;
  leagues?: { id: number; name: string }[];
  /** Invites to this League's team only: the Role is required, and there's
   * no team to choose. */
  league?: { id: number; name: string };
}) {
  const [state, formAction, pending] = useActionState(
    sendInvitation.bind(null, organizationId),
    initialState,
  );

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="role">
            {league ? "Role" : "Role (optional)"}
          </FieldLabel>
          <select
            id="role"
            name="role"
            className={selectClass}
            defaultValue=""
            required={league !== undefined}
          >
            <option value="" disabled={league !== undefined}>
              {league ? "Choose a role" : "No role"}
            </option>
            {LEAGUE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </Field>
        {league ? (
          <input type="hidden" name="team" value={league.id} />
        ) : (
          <Field>
            <FieldLabel htmlFor="team">On</FieldLabel>
            <select
              id="team"
              name="team"
              className={selectClass}
              defaultValue="default"
            >
              <option value="default">Default team</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <FieldDescription>
              Only used when you choose a role. They can&apos;t be invited as an
              Admin.
            </FieldDescription>
          </Field>
        )}
        {state.error && (
          <Field data-invalid>
            <FieldError>{state.error}</FieldError>
          </Field>
        )}
        {state.sentTo && (
          <p className="text-sm text-muted-foreground">
            Invitation sent to {state.sentTo}.
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </FieldGroup>
    </form>
  );
}
