"use client";

import { useActionState } from "react";

import { createMeet, type CreateMeetState } from "@/lib/meets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const initialState: CreateMeetState = {};

export function CreateMeetForm() {
  const [state, formAction, pending] = useActionState(createMeet, initialState);

  return (
    <form action={formAction} className="max-w-sm">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Meet name</FieldLabel>
          <Input id="name" name="name" required placeholder="GNB League 1" />
        </Field>
        <Field>
          <FieldLabel htmlFor="meetDate">Date</FieldLabel>
          <Input id="meetDate" name="meetDate" type="date" required />
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
          {pending ? "Creating…" : "Create meet"}
        </Button>
      </FieldGroup>
    </form>
  );
}
