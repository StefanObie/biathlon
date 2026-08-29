"use client";

import { useActionState } from "react";

import { importEntries, type ImportEntriesState } from "@/lib/meets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ImportEntriesState = {};

export function ImportEntriesForm({ meetId }: { meetId: number }) {
  const importEntriesForMeet = importEntries.bind(null, meetId);
  const [state, formAction, pending] = useActionState(
    importEntriesForMeet,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-2">
        <Label htmlFor="file">Entry list (.csv or .xlsx)</Label>
        <Input id="file" name="file" type="file" accept=".csv,.xlsx" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Importing…" : "Import entries"}
      </Button>

      {state.fatalError && (
        <p className="text-sm text-destructive">{state.fatalError}</p>
      )}

      {state.imported !== undefined && (
        <p className="text-sm">
          Imported <strong>{state.imported}</strong> entr
          {state.imported === 1 ? "y" : "ies"}.
        </p>
      )}

      {state.errors && state.errors.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-destructive">
            {state.errors.length} row{state.errors.length === 1 ? "" : "s"}{" "}
            skipped:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5">
            {state.errors.map((e) => (
              <li key={e.rowNumber}>
                Row {e.rowNumber}: {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
