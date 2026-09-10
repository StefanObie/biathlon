"use client";

import { useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";

import { saveStartList } from "@/lib/leagues/actions";
import { AddWalkUpAthleteForm } from "@/components/leagues/add-walk-up-athlete-form";
import { parseUploadedEntryFile } from "@/lib/import/parse-file";
import {
  parseEntryRows,
  resolveColumns,
  type EntryRowError,
  type ParsedEntryRow,
} from "@/lib/import/entry-row";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export interface StartListEntry {
  athleteNo: number;
  fullName: string;
  gender: string;
  ageGroupCode: string;
  runHeat: number;
  swimHeat: number;
  swimLane: number;
}

type Stage =
  | { name: "committed" }
  | { name: "preview"; parsed: ParsedEntryRow[]; errors: EntryRowError[] }
  | { name: "parsing" };

export function StartList({
  leagueId,
  committed,
}: {
  leagueId: number;
  committed: StartListEntry[];
}) {
  const [stage, setStage] = useState<Stage>({ name: "committed" });
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  async function handleFile(file: File) {
    setParseError(null);
    setStage({ name: "parsing" });

    let rawRows: Record<string, string>[];
    try {
      rawRows = await parseUploadedEntryFile(file);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Could not read file.",
      );
      setStage({ name: "committed" });
      return;
    }

    if (rawRows.length === 0) {
      setParseError("File has no data rows.");
      setStage({ name: "committed" });
      return;
    }

    const columns = resolveColumns(Object.keys(rawRows[0]));
    if (!columns) {
      setParseError(
        "Couldn't find all required columns (Age Group, Athlete name, Athlete No, Run Heat, Swim Heat, Swim Lane).",
      );
      setStage({ name: "committed" });
      return;
    }

    const { parsed, errors } = parseEntryRows(rawRows, columns);
    setStage({ name: "preview", parsed, errors });
  }

  function handleSave() {
    if (stage.name !== "preview") return;
    const { parsed } = stage;
    setSaveError(null);
    startSaving(async () => {
      const result = await saveStartList(leagueId, parsed);
      if (result.fatalError) {
        setSaveError(result.fatalError);
        return;
      }
      setStage({ name: "committed" });
    });
  }

  if (stage.name === "preview" || stage.name === "parsing") {
    return (
      <div className="flex flex-col gap-4">
        {stage.name === "parsing" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Reading file…
          </p>
        ) : (
          <PreviewTable
            parsed={stage.parsed}
            errors={stage.errors}
            onCancel={() => setStage({ name: "committed" })}
            onSave={handleSave}
            isSaving={isSaving}
            saveError={saveError}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {committed.length === 0 ? (
        <Dropzone onFile={handleFile} error={parseError} />
      ) : (
        <CommittedTable
          leagueId={leagueId}
          entries={committed}
          onFile={handleFile}
          error={parseError}
        />
      )}
    </div>
  );
}

function Dropzone({
  onFile,
  error,
}: {
  onFile: (file: File) => void;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Empty
      className={
        isDragging ? "border-primary bg-accent/50" : "border-input border"
      }
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UploadIcon />
        </EmptyMedia>
        <EmptyTitle>No start list yet</EmptyTitle>
        <EmptyDescription>
          Drag and drop the entry file (.csv or .xlsx) here, or browse to select
          one. Columns needed (any order): Age Group, Athlete name, Athlete No,
          Run Heat, Swim Heat, Swim Lane.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => inputRef.current?.click()}>
          Browse for file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        {error && (
          <Field data-invalid>
            <FieldError>{error}</FieldError>
          </Field>
        )}
      </EmptyContent>
    </Empty>
  );
}

function CommittedTable({
  leagueId,
  entries,
  onFile,
  error,
}: {
  leagueId: number;
  entries: StartListEntry[];
  onFile: (file: File) => void;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {entries.length} athletes
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <a
              href={`/leagues/${leagueId}/bibs/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              Download QR codes
            </a>
          </Button>
          <AddWalkUpAthleteForm leagueId={leagueId} />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            Import new data
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && (
        <Field data-invalid>
          <FieldError>{error}</FieldError>
        </Field>
      )}

      <EntryTable
        rows={entries.map((e) => ({
          athleteNo: e.athleteNo,
          fullName: e.fullName,
          ageGroupCode: e.ageGroupCode,
          gender: e.gender,
          runHeat: e.runHeat,
          swimHeat: e.swimHeat,
          swimLane: e.swimLane,
        }))}
      />
    </div>
  );
}

function PreviewTable({
  parsed,
  errors,
  onCancel,
  onSave,
  isSaving,
  saveError,
}: {
  parsed: ParsedEntryRow[];
  errors: EntryRowError[];
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Previewing {parsed.length} athletes from the uploaded file. Saving
          will replace the current start list.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving || parsed.length === 0}>
            {isSaving && <Spinner data-icon="inline-start" />}
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {saveError && (
        <Field data-invalid>
          <FieldError>{saveError}</FieldError>
        </Field>
      )}

      {errors.length > 0 && (
        <Field data-invalid>
          <FieldError>
            {errors.length} row{errors.length === 1 ? "" : "s"} skipped:
            <ul className="ml-4 list-disc">
              {errors.map((e) => (
                <li key={e.rowNumber}>
                  Row {e.rowNumber}: {e.reason}
                </li>
              ))}
            </ul>
          </FieldError>
        </Field>
      )}

      {parsed.length === 0 ? (
        <FieldDescription>No valid rows to save.</FieldDescription>
      ) : (
        <EntryTable
          rows={parsed.map((p) => ({
            athleteNo: p.row.athleteNo,
            fullName: p.row.fullName,
            ageGroupCode: p.ageGroupCode,
            gender: p.gender,
            runHeat: p.row.runHeat,
            swimHeat: p.row.swimHeat,
            swimLane: p.row.swimLane,
          }))}
        />
      )}
    </div>
  );
}

function EntryTable({
  rows,
}: {
  rows: {
    athleteNo: number;
    fullName: string;
    ageGroupCode: string;
    gender: string;
    runHeat: number;
    swimHeat: number;
    swimLane: number;
  }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>No.</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Age group</TableHead>
          <TableHead>Run heat</TableHead>
          <TableHead>Swim heat</TableHead>
          <TableHead>Swim lane</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.athleteNo}>
            <TableCell className="font-mono tabular-nums">
              {row.athleteNo}
            </TableCell>
            <TableCell>{row.fullName}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {row.ageGroupCode} {row.gender}
              </Badge>
            </TableCell>
            <TableCell className="font-mono tabular-nums">
              {row.runHeat}
            </TableCell>
            <TableCell className="font-mono tabular-nums">
              {row.swimHeat}
            </TableCell>
            <TableCell className="font-mono tabular-nums">
              {row.swimLane}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
