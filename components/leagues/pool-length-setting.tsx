"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setPoolLength } from "@/lib/swim/actions";
import {
  isPoolLength,
  POOL_LENGTHS,
  type PoolLength,
} from "@/lib/results/points";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The pool the League's swim session was held in. A swim in a 25 m pool
 * loses the Short course adjustment from its points, so changing it rescores
 * the published results straight away.
 */
export function PoolLengthSetting({
  organizationId,
  leagueId,
  poolLength,
}: {
  organizationId: number;
  leagueId: number;
  poolLength: PoolLength;
}) {
  const [isPending, startTransition] = useTransition();

  function change(value: string) {
    const length = Number(value);
    if (!isPoolLength(length)) return;
    startTransition(async () => {
      const { error } = await setPoolLength(
        { organizationId, leagueId },
        length,
      );
      if (error) toast.error(error);
      else toast.success("Saved.");
    });
  }

  return (
    <Field className="max-w-xs">
      <FieldLabel htmlFor="poolLength">Pool length</FieldLabel>
      <Select
        value={String(poolLength)}
        onValueChange={change}
        disabled={isPending}
      >
        <SelectTrigger id="poolLength" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {POOL_LENGTHS.map((length) => (
            <SelectItem key={length} value={String(length)}>
              {length} m
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>
        Swim points in a 25 m pool include SA Biathlon&apos;s Short course
        adjustment.
      </FieldDescription>
    </Field>
  );
}
