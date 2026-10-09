"use client";

import { useState } from "react";
import { CloudDownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldError } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FetchProblem } from "@/lib/swim/drive-actions";

/**
 * Fetching the Swim results file from the Organization's Swim folder (#71):
 * the button, and whatever the last fetch needs from the Official next.
 */
export function SwimDriveFetch({
  state,
  isFetching,
  onFetch,
  onChooseFolder,
}: {
  /** The last fetch that didn't produce a file, or null before any. */
  state: FetchProblem | null;
  isFetching: boolean;
  onFetch: () => void;
  onChooseFolder: (folderId: string) => void;
}) {
  const [folderId, setFolderId] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-md border border-input p-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium">Fetch from Drive</p>
        <p className="text-sm text-muted-foreground">
          Reads the newest swim results file in this league&apos;s folder.
          Nothing is saved until you confirm.
        </p>
      </div>

      {state?.status === "no-swim-folder" && (
        <p className="text-sm text-muted-foreground">
          No Swim folder is set for this organization yet. An Admin sets it on
          the organization&apos;s Swim folder tab.
        </p>
      )}

      {state?.status === "no-file" && (
        <p className="text-sm text-muted-foreground">
          No results file in {state.leagueFolder.name} yet.
        </p>
      )}

      {state?.status === "error" && (
        <Field data-invalid>
          <FieldError>{state.message}</FieldError>
        </Field>
      )}

      {state?.status === "pick-folder" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            No folder is called{" "}
            <span className="font-medium">{state.expectedName}</span>. Pick this
            league&apos;s folder; it&apos;s remembered for next time.
          </p>
          {state.folders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The Swim folder has no folders in it.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {state.folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={folderId === "" || isFetching}
                onClick={() => onChooseFolder(folderId)}
              >
                {isFetching ? <Spinner /> : null} Use this folder
              </Button>
            </div>
          )}
        </div>
      )}

      <div>
        <Button
          variant={state?.status === "pick-folder" ? "outline" : "default"}
          onClick={onFetch}
          disabled={isFetching}
        >
          {isFetching ? <Spinner /> : <CloudDownloadIcon />} Fetch latest from
          Google Drive
        </Button>
      </div>
    </div>
  );
}
