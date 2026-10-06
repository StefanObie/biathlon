"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlusIcon } from "lucide-react";

import {
  addLateEntry,
  lookUpLateEntry,
  type AddLateEntryState,
  type LateEntryLookup,
} from "@/lib/leagues/actions";
import { AGE_GROUP_LABELS, parseAgeGroup } from "@/lib/import/age-group";
import { alreadyOnStartListMessage } from "@/lib/leagues/late-entry";
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

const initialState: AddLateEntryState = {};

/**
 * Adds a Late entry — an athlete added to the Start list after the import —
 * so they show up in position/timer capture and reconciliation like any
 * other entrant. A dialog rather than an inline row on the start-list
 * table: this is a rare, deliberate action, not part of the normal
 * import/preview flow above it.
 */
export function AddLateEntryForm({
  organizationId,
  leagueId,
}: {
  organizationId: number;
  leagueId: number;
}) {
  const [open, setOpen] = useState(false);
  // A new key each time the dialog opens starts the form afresh.
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <UserPlusIcon />
        Add athlete
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a late entry</DialogTitle>
        </DialogHeader>
        <LateEntryForm
          key={formKey}
          organizationId={organizationId}
          leagueId={leagueId}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LateEntryForm({
  organizationId,
  leagueId,
  onDone,
}: {
  organizationId: number;
  leagueId: number;
  onDone: () => void;
}) {
  const action = addLateEntry.bind(null, { organizationId, leagueId });
  const [state, formAction, pending] = useActionState(action, initialState);
  const [athleteNo, setAthleteNo] = useState("");
  const [lookup, setLookup] = useState<{
    athleteNo: string;
    result: LateEntryLookup;
  } | null>(null);

  useEffect(() => {
    if (state.saved) onDone();
  }, [state, onDone]);

  // Look the number up once the Official stops typing; a reply for a number
  // that has since changed is dropped.
  useEffect(() => {
    const n = Number(athleteNo);
    if (!Number.isInteger(n) || n <= 0) return;
    let current = true;
    const timer = setTimeout(async () => {
      const result = await lookUpLateEntry({ organizationId, leagueId }, n);
      if (current) setLookup({ athleteNo, result });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [athleteNo, organizationId, leagueId]);

  const result = lookup?.athleteNo === athleteNo ? lookup.result : null;
  const decision = result && "decision" in result ? result.decision : null;
  const existing = decision?.kind === "existing-athlete" ? decision : null;
  const ageGroupLabels = existing
    ? AGE_GROUP_LABELS.filter(
        (label) => parseAgeGroup(label)?.gender === existing.gender,
      )
    : AGE_GROUP_LABELS;
  const refused =
    decision?.kind === "already-on-start-list"
      ? alreadyOnStartListMessage(Number(athleteNo), decision.runHeat)
      : result && "error" in result
        ? result.error
        : null;

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
            placeholder="90001"
            value={athleteNo}
            onChange={(e) => setAthleteNo(e.target.value)}
          />
          {refused && <FieldError>{refused}</FieldError>}
          {existing && (
            <FieldDescription>
              Already an athlete of the Organization.
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="fullName">Full name</FieldLabel>
          {existing ? (
            <Input
              key="existing"
              id="fullName"
              name="fullName"
              readOnly
              value={existing.fullName}
            />
          ) : (
            <Input key="new" id="fullName" name="fullName" required />
          )}
        </Field>
        {existing && (
          <Field>
            <FieldLabel htmlFor="gender">Gender</FieldLabel>
            <Input
              id="gender"
              readOnly
              value={existing.gender === "F" ? "Female" : "Male"}
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="ageGroupLabel">Age group</FieldLabel>
          <Select
            // Remount to pick up a new suggestion for a different athlete.
            key={existing ? `existing-${athleteNo}` : "new"}
            name="ageGroupLabel"
            defaultValue={existing?.suggestedAgeGroupLabel ?? undefined}
            required
          >
            <SelectTrigger id="ageGroupLabel" className="w-full">
              <SelectValue placeholder="Select an age group" />
            </SelectTrigger>
            <SelectContent>
              {ageGroupLabels.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="runHeat">Run heat</FieldLabel>
          <Input id="runHeat" name="runHeat" type="number" min={1} required />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="swimHeat">Swim heat</FieldLabel>
          <Input id="swimHeat" name="swimHeat" type="number" min={1} />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="swimLane">Swim lane</FieldLabel>
          <Input id="swimLane" name="swimLane" type="number" min={1} />
        </Field>
        <FieldDescription>
          Leave the swim heat and lane empty if they aren&apos;t known yet.
        </FieldDescription>
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
        <Button
          type="submit"
          disabled={pending || decision?.kind === "already-on-start-list"}
        >
          {pending ? "Adding…" : "Add athlete"}
        </Button>
      </DialogFooter>
    </form>
  );
}
