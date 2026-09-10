"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlusIcon } from "lucide-react";

import {
  addWalkUpAthlete,
  type AddWalkUpAthleteState,
} from "@/lib/leagues/actions";
import { AGE_GROUP_LABELS } from "@/lib/import/age-group";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const initialState: AddWalkUpAthleteState = {};

/**
 * Registers a race-day walk-up — someone who wasn't in the imported start
 * list — so they show up in position/timer capture and reconciliation like
 * any other entrant. A dialog rather than an inline row on the start-list
 * table: this is a rare, deliberate action, not part of the normal
 * import/preview flow above it.
 */
export function AddWalkUpAthleteForm({ leagueId }: { leagueId: number }) {
  const [open, setOpen] = useState(false);
  const action = addWalkUpAthlete.bind(null, leagueId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.saved) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlusIcon />
        Add athlete
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a walk-up athlete</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <FieldGroup>
            <Field orientation="responsive">
              <FieldLabel htmlFor="athleteNo">Athlete number</FieldLabel>
              <Input
                id="athleteNo"
                name="athleteNo"
                type="number"
                min={1}
                required
                placeholder="90001"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fullName">Full name</FieldLabel>
              <Input id="fullName" name="fullName" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="ageGroupLabel">Age group</FieldLabel>
              <Select name="ageGroupLabel" required>
                <SelectTrigger id="ageGroupLabel" className="w-full">
                  <SelectValue placeholder="Select an age group" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_GROUP_LABELS.map((label) => (
                    <SelectItem key={label} value={label}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="responsive">
              <FieldLabel htmlFor="runHeat">Run heat</FieldLabel>
              <Input
                id="runHeat"
                name="runHeat"
                type="number"
                min={1}
                required
              />
            </Field>
            <Field orientation="responsive">
              <FieldLabel htmlFor="swimHeat">Swim heat</FieldLabel>
              <Input
                id="swimHeat"
                name="swimHeat"
                type="number"
                min={1}
                required
              />
            </Field>
            <Field orientation="responsive">
              <FieldLabel htmlFor="swimLane">Swim lane</FieldLabel>
              <Input
                id="swimLane"
                name="swimLane"
                type="number"
                min={1}
                required
              />
            </Field>
            {state.error && (
              <Field data-invalid>
                <FieldError>{state.error}</FieldError>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add athlete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
