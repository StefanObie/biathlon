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

const initialState: CreateLeagueState = {};

export function CreateLeagueForm() {
  const [state, formAction, pending] = useActionState(
    createLeague,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-sm">
      <FieldGroup>
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
