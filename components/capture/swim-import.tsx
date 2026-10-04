"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError } from "@/components/ui/field";
import {
  AthleteCombobox,
  type AthleteOption,
} from "@/components/capture/athlete-combobox";
import { parseSwimResults } from "@/lib/swim/parse-results";
import {
  duplicateAthletes,
  missingFromFile,
  resolveSwimRows,
  type ResolvedSwimRow,
  type RosterEntry,
  type SwimRowState,
} from "@/lib/swim/resolve";
import { saveSwimResults } from "@/lib/swim/actions";

export interface ExistingSwimResult {
  athlete_no: number;
  swim_time: string | null;
  status: string;
  source: string;
}

const TIME_PATTERN = /^\d{2}:\d{2}\.\d{2}$/;

const STATE_LABEL: Record<SwimRowState, string> = {
  matched: "Matched",
  "matched-by-lane": "Matched by lane",
  "needs-review": "Needs review",
  unresolved: "Unresolved",
  "no-result": "No result",
};

const STATE_VARIANT: Record<
  SwimRowState,
  "default" | "secondary" | "destructive" | "outline"
> = {
  matched: "secondary",
  "matched-by-lane": "secondary",
  "needs-review": "default",
  unresolved: "destructive",
  "no-result": "outline",
};

type Stage =
  { name: "idle" } | { name: "parsing" } | { name: "review"; fileName: string };

/** What a re-import would do to a row that is already saved (Q7). */
type Change = "new" | "updated" | "unchanged" | "overrides-manual";

export function SwimImport({
  organizationId,
  leagueId,
  leagueName,
  roster,
  existing,
}: {
  organizationId: number;
  leagueId: number;
  leagueName: string;
  roster: RosterEntry[];
  existing: ExistingSwimResult[];
}) {
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [rows, setRows] = useState<ResolvedSwimRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [isSaving, startSaving] = useTransition();

  const athleteOptions: AthleteOption[] = useMemo(
    () =>
      roster.map((entry) => ({
        athleteNo: entry.athleteNo,
        fullName: entry.fullName,
      })),
    [roster],
  );

  const existingByNo = useMemo(() => {
    const map = new Map<number, ExistingSwimResult>();
    for (const row of existing) map.set(row.athlete_no, row);
    return map;
  }, [existing]);

  async function handleFile(file: File) {
    setParseError(null);
    setSaveError(null);
    setSaved(null);
    setStage({ name: "parsing" });

    let text: string;
    try {
      text = await file.text();
    } catch {
      setParseError("Could not read that file.");
      setStage({ name: "idle" });
      return;
    }

    const raw = parseSwimResults(text);
    if (raw.length === 0) {
      setParseError(
        "No result blocks found. Expected a Time Drops console export (.txt).",
      );
      setStage({ name: "idle" });
      return;
    }

    setRows(resolveSwimRows(raw, roster));
    setStage({ name: "review", fileName: file.name });
  }

  function updateRow(localId: string, patch: Partial<ResolvedSwimRow>) {
    setRows((prev) =>
      prev.map((row) =>
        row.localId === localId ? { ...row, ...patch, edited: true } : row,
      ),
    );
  }

  /** Rows that will actually be written: resolved, and not an empty lane. */
  const savableRows = useMemo(
    () => rows.filter((r) => r.state !== "no-result" && r.athleteNo !== null),
    [rows],
  );

  const changeFor = useMemo(() => {
    const map = new Map<string, Change>();
    for (const row of savableRows) {
      const prior = existingByNo.get(row.athleteNo as number);
      if (!prior) {
        map.set(row.localId, "new");
      } else if (prior.source === "manual") {
        map.set(row.localId, "overrides-manual");
      } else if (prior.swim_time === row.time && prior.status === row.status) {
        map.set(row.localId, "unchanged");
      } else {
        map.set(row.localId, "updated");
      }
    }
    return map;
  }, [savableRows, existingByNo]);

  const counts = useMemo(() => {
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let overridesManual = 0;
    for (const change of changeFor.values()) {
      if (change === "new") created++;
      else if (change === "updated") updated++;
      else if (change === "unchanged") unchanged++;
      else overridesManual++;
    }
    return { created, updated, unchanged, overridesManual };
  }, [changeFor]);

  const unresolvedCount = rows.filter((r) => r.state === "unresolved").length;
  const needsReviewCount = rows.filter(
    (r) => r.state === "needs-review",
  ).length;
  const duplicates = useMemo(() => duplicateAthletes(rows), [rows]);
  const missing = useMemo(
    () => (rows.length > 0 ? missingFromFile(rows, roster) : []),
    [rows, roster],
  );

  const invalidTime = savableRows.find(
    (r) => r.time !== null && !TIME_PATTERN.test(r.time),
  );

  const blocked =
    unresolvedCount > 0 || duplicates.length > 0 || invalidTime !== undefined;

  function handleSave() {
    if (stage.name !== "review" || blocked) return;
    setSaveError(null);
    startSaving(async () => {
      const result = await saveSwimResults(
        { organizationId, leagueId },
        stage.name === "review" ? stage.fileName : "",
        savableRows.map((row) => ({
          athleteNo: row.athleteNo as number,
          eventNo: row.raw.eventNo,
          heat: row.raw.heat,
          lane: row.raw.lane,
          distanceM: row.raw.distanceM,
          swimTime: row.status === "ok" ? row.time : null,
          place: row.raw.place,
          status: row.status,
          sourceLine: row.raw.sourceLine,
          needsReview: row.state === "needs-review",
          edited: row.edited,
        })),
        {
          created: counts.created,
          updated: counts.updated,
          unchanged: counts.unchanged,
          needsReview: needsReviewCount,
        },
      );
      if (result.fatalError) {
        setSaveError(result.fatalError);
        return;
      }
      setSaved(result.saved ?? 0);
      setStage({ name: "idle" });
      setRows([]);
    });
  }

  if (stage.name === "parsing") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Reading file…
      </p>
    );
  }

  if (stage.name === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <Header leagueName={leagueName} existingCount={existing.length} />
        {saved !== null && (
          <p className="rounded-md border border-input bg-accent/40 p-3 text-sm">
            Saved {saved} swim {saved === 1 ? "result" : "results"}.
          </p>
        )}
        <Dropzone onFile={handleFile} error={parseError} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Header leagueName={leagueName} existingCount={existing.length} />

      <div className="flex flex-col gap-2 rounded-md border border-input p-3 text-sm">
        <p className="font-medium">{stage.fileName}</p>
        <p className="text-muted-foreground">
          {counts.created} new · {counts.updated} updated · {counts.unchanged}{" "}
          unchanged
          {counts.overridesManual > 0 && (
            <> · {counts.overridesManual} would overwrite a manual edit</>
          )}
        </p>
        {needsReviewCount > 0 && (
          <p className="text-muted-foreground">
            {needsReviewCount} flagged for review — saveable, but check them.
          </p>
        )}
      </div>

      {unresolvedCount > 0 && (
        <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
          {unresolvedCount}{" "}
          {unresolvedCount === 1 ? "swimmer is" : "swimmers are"} not on the
          start list. Assign each one, or add them to the start list and upload
          again.
        </p>
      )}

      {duplicates.length > 0 && (
        <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
          {duplicates.join(", ")}{" "}
          {duplicates.length === 1 ? "appears" : "appear"} on more than one row
          — an athlete swims once.
        </p>
      )}

      {invalidTime && (
        <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
          {invalidTime.athleteName ?? invalidTime.athleteNo}: time must be
          mm:SS.ss
        </p>
      )}

      <ReviewTable
        rows={rows}
        changeFor={changeFor}
        athleteOptions={athleteOptions}
        onUpdate={updateRow}
      />

      {missing.length > 0 && <MissingList missing={missing} />}

      {saveError && (
        <Field data-invalid>
          <FieldError>{saveError}</FieldError>
        </Field>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setStage({ name: "idle" });
            setRows([]);
          }}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={blocked || isSaving}>
          {isSaving ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            `Confirm and save ${savableRows.length} results`
          )}
        </Button>
      </div>
    </div>
  );
}

function Header({
  leagueName,
  existingCount,
}: {
  leagueName: string;
  existingCount: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-lg font-semibold">Swim import</h1>
      <p className="text-sm text-muted-foreground">
        {leagueName}
        {existingCount > 0 && ` · ${existingCount} swim results saved`}
      </p>
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
        isDragging ? "border-primary bg-accent/50" : "border border-input"
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
        <EmptyTitle>Upload the swim results</EmptyTitle>
        <EmptyDescription>
          Drag and drop the Time Drops console export (.txt) here, or browse to
          select one. Nothing is saved until you confirm.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => inputRef.current?.click()}>
          Browse for file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".txt"
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

function ReviewTable({
  rows,
  changeFor,
  athleteOptions,
  onUpdate,
}: {
  rows: ResolvedSwimRow[];
  changeFor: Map<string, Change>;
  athleteOptions: AthleteOption[];
  onUpdate: (localId: string, patch: Partial<ResolvedSwimRow>) => void;
}) {
  return (
    <>
      {/* Mobile: one card per row — the table is too wide to squeeze (NOTES.md). */}
      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((row) => (
          <RowCard
            key={row.localId}
            row={row}
            change={changeFor.get(row.localId)}
            athleteOptions={athleteOptions}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Heat</TableHead>
              <TableHead className="w-16">Lane</TableHead>
              <TableHead>From file</TableHead>
              <TableHead className="w-64">Athlete</TableHead>
              <TableHead className="w-28">Time</TableHead>
              <TableHead className="w-40">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.localId}
                className={row.state === "no-result" ? "opacity-50" : undefined}
              >
                <TableCell className="tabular-nums">{row.raw.heat}</TableCell>
                <TableCell className="tabular-nums">{row.raw.lane}</TableCell>
                <TableCell>
                  <FileCell row={row} />
                </TableCell>
                <TableCell>
                  {row.state === "no-result" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <AthleteCombobox
                      options={athleteOptions}
                      value={
                        row.athleteNo !== null
                          ? {
                              athleteNo: row.athleteNo,
                              fullName: row.athleteName ?? "",
                            }
                          : null
                      }
                      onSelect={(athlete) =>
                        onUpdate(row.localId, {
                          athleteNo: athlete.athleteNo,
                          athleteName: athlete.fullName,
                          state: "matched",
                          suggestion: null,
                        })
                      }
                    />
                  )}
                </TableCell>
                <TableCell>
                  {row.state === "no-result" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Input
                      value={row.time ?? ""}
                      placeholder="mm:SS.ss"
                      inputMode="numeric"
                      className="h-8 w-24 tabular-nums"
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        onUpdate(row.localId, {
                          time: value === "" ? null : value,
                          status: value === "" ? "dns" : "ok",
                        });
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <StatusCell row={row} change={changeFor.get(row.localId)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function FileCell({ row }: { row: ResolvedSwimRow }) {
  if (row.state === "no-result") {
    return <span className="text-muted-foreground">Empty lane (NS)</span>;
  }
  return (
    <div className="flex flex-col">
      <span>
        {row.raw.name}
        {row.raw.athleteNo !== null && (
          <span className="text-muted-foreground">
            {" "}
            ({row.raw.athleteNo}
            {row.raw.truncated ? "…" : ""})
          </span>
        )}
      </span>
      {row.raw.backupsDisagree && (
        <span className="text-xs text-muted-foreground tabular-nums">
          backups: {row.raw.backupTimes.join(" / ")}
        </span>
      )}
    </div>
  );
}

function StatusCell({
  row,
  change,
}: {
  row: ResolvedSwimRow;
  change: Change | undefined;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={STATE_VARIANT[row.state]}>{STATE_LABEL[row.state]}</Badge>
      {row.status === "dns" && row.state !== "no-result" && (
        <Badge variant="outline">DNS</Badge>
      )}
      {change === "updated" && (
        <span className="text-xs text-muted-foreground">
          changes saved time
        </span>
      )}
      {change === "overrides-manual" && (
        <span className="text-xs text-destructive">overwrites manual edit</span>
      )}
      {row.reasons.map((reason) => (
        <span key={reason} className="text-xs text-muted-foreground">
          {reason}
        </span>
      ))}
      {row.suggestion && (
        <span className="text-xs text-muted-foreground">
          Suggested: {row.suggestion.athleteNo} {row.suggestion.fullName}
        </span>
      )}
    </div>
  );
}

function RowCard({
  row,
  change,
  athleteOptions,
  onUpdate,
}: {
  row: ResolvedSwimRow;
  change: Change | undefined;
  athleteOptions: AthleteOption[];
  onUpdate: (localId: string, patch: Partial<ResolvedSwimRow>) => void;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-md border border-input p-3 ${
        row.state === "no-result" ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium tabular-nums">
          Heat {row.raw.heat} · Lane {row.raw.lane}
        </span>
        <Badge variant={STATE_VARIANT[row.state]}>
          {STATE_LABEL[row.state]}
        </Badge>
      </div>

      <FileCell row={row} />

      {row.state !== "no-result" && (
        <>
          <AthleteCombobox
            options={athleteOptions}
            value={
              row.athleteNo !== null
                ? {
                    athleteNo: row.athleteNo,
                    fullName: row.athleteName ?? "",
                  }
                : null
            }
            onSelect={(athlete) =>
              onUpdate(row.localId, {
                athleteNo: athlete.athleteNo,
                athleteName: athlete.fullName,
                state: "matched",
                suggestion: null,
              })
            }
          />
          <Input
            value={row.time ?? ""}
            placeholder="mm:SS.ss"
            inputMode="numeric"
            className="h-9 tabular-nums"
            onChange={(e) => {
              const value = e.target.value.trim();
              onUpdate(row.localId, {
                time: value === "" ? null : value,
                status: value === "" ? "dns" : "ok",
              });
            }}
          />
        </>
      )}

      {(row.reasons.length > 0 || change === "overrides-manual") && (
        <div className="flex flex-col gap-1">
          {change === "overrides-manual" && (
            <span className="text-xs text-destructive">
              overwrites manual edit
            </span>
          )}
          {row.reasons.map((reason) => (
            <span key={reason} className="text-xs text-muted-foreground">
              {reason}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MissingList({ missing }: { missing: RosterEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-input p-3 text-sm">
      <button
        type="button"
        className="text-left text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {missing.length} entered{" "}
        {missing.length === 1 ? "athlete has" : "athletes have"} no row in this
        file {open ? "▾" : "▸"}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
          {missing.map((entry) => (
            <li key={entry.athleteNo} className="tabular-nums">
              {entry.athleteNo} {entry.fullName} · heat {entry.swimHeat} lane{" "}
              {entry.swimLane}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        No results are saved for these athletes — absence from the file is not
        recorded as a DNS.
      </p>
    </div>
  );
}
