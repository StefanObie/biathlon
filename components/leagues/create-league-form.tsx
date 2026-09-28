"use client";

import { useActionState } from "react";

import { createLeague, type CreateLeagueState } from "@/lib/leagues/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: CreateLeagueState = {};

/**
 * `organizations` are the ones the user is an Admin of, so it's never empty
 * here. With only one there's nothing to choose, so it's sent hidden.
 */
export function CreateLeagueForm({
  organizations,
}: {
  organizations: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createLeague,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-sm">
      <FieldGroup>
        {organizations.length === 1 ? (
          <input
            type="hidden"
            name="organizationId"
            value={organizations[0].id}
          />
        ) : (
          <Field>
            <FieldLabel htmlFor="organizationId">Organization</FieldLabel>
            <Select name="organizationId" required>
              <SelectTrigger id="organizationId" className="w-full">
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem
                    key={organization.id}
                    value={String(organization.id)}
                  >
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="name">League name</FieldLabel>
          <Input id="name" name="name" required placeholder="GNB League 1" />
        </Field>
        <Field>
          <FieldLabel htmlFor="leagueDate">Date</FieldLabel>
          <Input id="leagueDate" name="leagueDate" type="date" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="season">Season</FieldLabel>
          <Input
            id="season"
            name="season"
            type="number"
            required
            defaultValue={new Date().getFullYear()}
          />
        </Field>
        {state.error && (
          <Field data-invalid>
            <FieldError>{state.error}</FieldError>
          </Field>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create league"}
        </Button>
      </FieldGroup>
    </form>
  );
}
