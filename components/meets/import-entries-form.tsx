"use client";

import { useActionState } from "react";

import { importEntries, type ImportEntriesState } from "@/lib/meets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const initialState: ImportEntriesState = {};

export function ImportEntriesForm({ meetId }: { meetId: number }) {
  const importEntriesForMeet = importEntries.bind(null, meetId);
  const [state, formAction, pending] = useActionState(
    importEntriesForMeet,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-md">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="file">Entry list (.csv or .xlsx)</FieldLabel>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".csv,.xlsx"
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import entries"}
        </Button>

        {state.fatalError && (
          <Field data-invalid>
            <FieldError>{state.fatalError}</FieldError>
          </Field>
        )}

        {state.imported !== undefined && (
          <FieldDescription className="text-success">
            Imported <strong>{state.imported}</strong> entr
            {state.imported === 1 ? "y" : "ies"}.
          </FieldDescription>
        )}

        {state.errors && state.errors.length > 0 && (
          <Field data-invalid>
            <FieldError>
              {state.errors.length} row{state.errors.length === 1 ? "" : "s"}{" "}
              skipped:
              <ul className="ml-4 list-disc">
                {state.errors.map((e) => (
                  <li key={e.rowNumber}>
                    Row {e.rowNumber}: {e.reason}
                  </li>
                ))}
              </ul>
            </FieldError>
          </Field>
        )}
      </FieldGroup>
    </form>
  );
}
