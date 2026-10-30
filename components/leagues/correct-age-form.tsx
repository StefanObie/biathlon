"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  correctAthleteAge,
  lookUpAthleteAge,
  type AthleteAgeLookup,
  type CorrectAthleteAgeState,
} from "@/lib/leagues/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const initialState: CorrectAthleteAgeState = {};

/**
 * Corrects one athlete's age, for example when they query their bonus on race
 * day. By Athlete number rather than a row of the Start list table, because
 * athletes belong to the Organization, not to this League.
 */
export function CorrectAgeForm({
  organizationId,
  leagueId,
}: {
  organizationId: number;
  leagueId: number;
}) {
  const [open, setOpen] = useState(false);
  // A new key each time the dialog opens starts the form afresh.
  const [formKey, setFormKey] = useState(0);
  // Stable, because the form says it's saved from an effect on this: it stays
  // mounted while the dialog animates closed, and must not say so twice.
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        Correct age
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct an athlete&apos;s age</DialogTitle>
        </DialogHeader>
        <AgeForm
          key={formKey}
          organizationId={organizationId}
          leagueId={leagueId}
          onDone={close}
        />
      </DialogContent>
    </Dialog>
  );
}

function AgeForm({
  organizationId,
  leagueId,
  onDone,
}: {
  organizationId: number;
  leagueId: number;
  onDone: () => void;
}) {
  const action = correctAthleteAge.bind(null, { organizationId, leagueId });
  const [state, formAction, pending] = useActionState(action, initialState);
  const [athleteNo, setAthleteNo] = useState("");
  const [lookup, setLookup] = useState<{
    athleteNo: string;
    result: AthleteAgeLookup;
  } | null>(null);

  useEffect(() => {
    if (!state.saved) return;
    toast.success("Age corrected. The results now show the new bonus.");
    onDone();
  }, [state, onDone]);

  // Look the number up once the Official stops typing; a reply for a number
  // that has since changed is dropped.
  useEffect(() => {
    const n = Number(athleteNo);
    if (!Number.isInteger(n) || n <= 0) return;
    let current = true;
    const timer = setTimeout(async () => {
      const result = await lookUpAthleteAge({ organizationId, leagueId }, n);
      if (current) setLookup({ athleteNo, result });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [athleteNo, organizationId, leagueId]);

  const result = lookup?.athleteNo === athleteNo ? lookup.result : null;
  const refused = result && "error" in result ? result.error : null;
  const found = result && "fullName" in result ? result : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field
          orientation="responsive"
          data-invalid={refused ? true : undefined}
        >
          <FieldLabel htmlFor="athleteNo">Athlete number</FieldLabel>
          <Input
            id="athleteNo"
            name="athleteNo"
            type="number"
            min={1}
            required
            value={athleteNo}
            onChange={(e) => setAthleteNo(e.target.value)}
          />
          {refused && <FieldError>{refused}</FieldError>}
          {found && (
            <FieldDescription>
              {found.fullName},{" "}
              {found.age === null ? "no age recorded" : `age ${found.age}`}
            </FieldDescription>
          )}
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="age">Age</FieldLabel>
          <Input id="age" name="age" type="number" required />
        </Field>
        {state.error && (
          <Field data-invalid>
            <FieldError>{state.error}</FieldError>
          </Field>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || refused !== null}>
          {pending ? "Saving…" : "Save age"}
        </Button>
      </DialogFooter>
    </form>
  );
}
