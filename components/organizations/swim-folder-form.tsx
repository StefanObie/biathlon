"use client";

import { useActionState } from "react";

import {
  setSwimFolder,
  type SetSwimFolderState,
} from "@/lib/swim/drive-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const initialState: SetSwimFolderState = {};

/** An Admin sets the Organization's Swim folder (#71). */
export function SwimFolderForm({
  organizationId,
  currentLink,
  serviceAccountEmail,
}: {
  organizationId: number;
  currentLink: string;
  serviceAccountEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    setSwimFolder.bind(null, organizationId),
    initialState,
  );

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="link">Swim folder link</FieldLabel>
          <Input
            id="link"
            name="link"
            defaultValue={currentLink}
            placeholder="https://drive.google.com/drive/folders/…"
          />
          <FieldDescription>
            The Google Drive folder holding one folder per league, each named
            like &ldquo;League 3 - 6 Oct 2026&rdquo; with the league&apos;s swim
            results file in it. Share it with{" "}
            {serviceAccountEmail ? (
              <span className="font-medium break-all">
                {serviceAccountEmail}
              </span>
            ) : (
              "the app's service account"
            )}{" "}
            as a viewer first. Leave it empty to stop fetching from Drive.
          </FieldDescription>
        </Field>
        {state.error && (
          <Field data-invalid>
            <FieldError>{state.error}</FieldError>
          </Field>
        )}
        {state.saved && !state.error && (
          <p className="text-sm text-muted-foreground">Saved.</p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Checking…" : "Save"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
