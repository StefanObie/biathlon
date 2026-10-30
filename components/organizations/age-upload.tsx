"use client";

import { useState, useTransition, type FormEvent } from "react";

import { parseAgeFile, type ReconciledAges } from "@/lib/import/age-file";
import { readAgeFileText } from "@/lib/import/age-file-text";
import {
  previewAgeUpload,
  saveAgeUpload,
} from "@/lib/organizations/age-actions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FIRST_YEAR = 2000;

type Preview = ReconciledAges & { yearTaken: number };

function athletes(count: number): string {
  return `${count} athlete${count === 1 ? "" : "s"}`;
}

/**
 * An Admin uploads the age file (#82): choose it, give the year the ages were
 * taken, check the preview, then confirm. Nothing is saved before that. Names
 * stay in the browser: only numbers, birth years, sex and group are sent.
 */
export function AgeUpload({ organizationId }: { organizationId: number }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const yearTaken = Number(form.get("yearTaken"));
    const thisYear = new Date().getFullYear();

    setError(null);
    setSaved(null);
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose the age file.");
      return;
    }
    if (
      !Number.isInteger(yearTaken) ||
      yearTaken < FIRST_YEAR ||
      yearTaken > thisYear
    ) {
      setError(`Enter a year from ${FIRST_YEAR} to ${thisYear}.`);
      return;
    }

    startTransition(async () => {
      let text: string;
      try {
        text = await readAgeFileText(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read file.");
        return;
      }

      const parsed = parseAgeFile(text, yearTaken);
      if (parsed.rows.length === 0 && parsed.skipped.length === 0) {
        setError("File has no data rows.");
        return;
      }

      const result = await previewAgeUpload(organizationId, parsed);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPreview({ ...result.preview, yearTaken });
    });
  }

  function handleConfirm() {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const result = await saveAgeUpload(
        organizationId,
        preview.yearTaken,
        preview.updates,
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPreview(null);
      setSaved(result.updated);
    });
  }

  if (preview) {
    const { updates, skipped, warnings, yearTaken } = preview;
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <p className="text-sm">
          <span className="font-medium">{athletes(updates.length)}</span> will
          be updated from ages taken in {yearTaken}. Any birth year they already
          have is overwritten, and athletes not in the file keep theirs.
        </p>
        {skipped.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">
              Skipped rows ({skipped.length})
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Athlete no</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skipped.map((skip) => (
                  <TableRow key={skip.line}>
                    <TableCell>{skip.line}</TableCell>
                    <TableCell>{skip.athleteNo ?? "—"}</TableCell>
                    <TableCell>{skip.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
        {warnings.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">
              Warnings ({warnings.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              These ages are still saved. Nothing else about the athlete
              changes.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete no</TableHead>
                  <TableHead>Warning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warnings.map((warning, index) => (
                  <TableRow key={index}>
                    <TableCell>{warning.athleteNo}</TableCell>
                    <TableCell>{warning.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
        {error && (
          <Field data-invalid>
            <FieldError>{error}</FieldError>
          </Field>
        )}
        <div className="flex gap-2">
          <Button
            onClick={handleConfirm}
            disabled={pending || updates.length === 0}
          >
            {pending ? "Saving…" : `Update ${athletes(updates.length)}`}
          </Button>
          <Button
            variant="outline"
            onClick={() => setPreview(null)}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePreview} className="max-w-xl">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="file">Age file</FieldLabel>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.csv,.txt"
            required
          />
          <FieldDescription>
            Columns: # Athlete Sex Age Province Group. Rows match by athlete
            number, and only the age is stored.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="yearTaken">Year the ages were taken</FieldLabel>
          <Input
            id="yearTaken"
            name="yearTaken"
            type="number"
            inputMode="numeric"
            min={FIRST_YEAR}
            required
            className="w-32"
          />
          <FieldDescription>
            Each birth year is this year minus the age in the file.
          </FieldDescription>
        </Field>
        {error && (
          <Field data-invalid>
            <FieldError>{error}</FieldError>
          </Field>
        )}
        {saved !== null && !error && (
          <p className="text-sm text-muted-foreground">
            Saved ages for {athletes(saved)}.
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Reading…" : "Preview"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
