"use client";

import { useActionState } from "react";

import { createMeet, type CreateMeetState } from "@/lib/meets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateMeetState = {};

export function CreateMeetForm() {
  const [state, formAction, pending] = useActionState(createMeet, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Meet name</Label>
        <Input id="name" name="name" required placeholder="GNB League 1" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="meetDate">Date</Label>
        <Input id="meetDate" name="meetDate" type="date" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="season">Season</Label>
        <Input
          id="season"
          name="season"
          type="number"
          required
          defaultValue={new Date().getFullYear()}
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create meet"}
      </Button>
    </form>
  );
}
