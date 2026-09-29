"use client";

import { useActionState } from "react";

import {
  createOrganization,
  type CreateOrganizationState,
} from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const initialState: CreateOrganizationState = {};

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(
    createOrganization,
    initialState,
  );

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Organization name</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            placeholder="Gauteng North Biathlon"
          />
        </Field>
        {state.error && (
          <Field data-invalid>
            <FieldError>{state.error}</FieldError>
          </Field>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create organization"}
        </Button>
      </FieldGroup>
    </form>
  );
}
