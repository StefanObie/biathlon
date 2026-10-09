"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import type { LeagueRef } from "@/lib/leagues/address";
import {
  DriveError,
  downloadText,
  folderInfo,
  listFiles,
  listFolders,
} from "@/lib/swim/drive";
import {
  driveFolderId,
  findLeagueFolder,
  leagueFolderName,
  pickResultsFile,
  type DriveItem,
} from "@/lib/swim/drive-folder";

export type FetchSwimResultsState =
  | {
      status: "fetched";
      leagueFolder: DriveItem;
      file: { id: string; name: string; modifiedTime: string; text: string };
      /** ISO time the file was read, for "Fetched at". */
      fetchedAt: string;
    }
  /** No Admin has set the Organization's Swim folder yet. */
  | { status: "no-swim-folder" }
  /** No League folder has the League's name: an Official picks one. */
  | { status: "pick-folder"; expectedName: string; folders: DriveItem[] }
  /** The League folder has no .txt yet. */
  | { status: "no-file"; leagueFolder: DriveItem }
  | { status: "error"; message: string };

/** A fetch that didn't produce a file, and what the Official does next. */
export type FetchProblem = Exclude<
  FetchSwimResultsState,
  { status: "fetched" }
>;

/**
 * Reads the League's Swim results file from Drive (#71), for the review
 * table to resolve exactly as it does an uploaded file. Nothing is saved:
 * only the League folder is remembered once found.
 *
 * The service account can read more than this Organization's Swim folder
 * (ADR 0005), so the League folder is always checked to sit in it, whether
 * it was just found or remembered.
 */
export async function fetchSwimResultsFile(
  league: LeagueRef,
): Promise<FetchSwimResultsState> {
  const context = await swimFolderContext(league);
  if ("status" in context) return context;
  const { supabase, swimFolderId, leagueName, leagueDate } = context;

  try {
    const { data: remembered } = await supabase
      .from("league_folder")
      .select("drive_folder_id")
      .eq("league_id", league.leagueId)
      .maybeSingle();

    let leagueFolder: DriveItem | null = null;
    if (remembered) {
      const info = await folderInfo(remembered.drive_folder_id).catch(
        () => null,
      );
      // A folder moved out of, or never in, the Swim folder is forgotten
      // and found again by name.
      if (info?.parents.includes(swimFolderId)) {
        leagueFolder = { id: remembered.drive_folder_id, name: info.name };
      }
    }

    if (!leagueFolder) {
      const folders = await listFolders(swimFolderId);
      leagueFolder = findLeagueFolder(folders, leagueName, leagueDate);
      if (!leagueFolder) {
        return {
          status: "pick-folder",
          expectedName: leagueFolderName(leagueName, leagueDate),
          folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
        };
      }
      await rememberLeagueFolder(supabase, league.leagueId, leagueFolder.id);
    }

    return await readResultsFile(leagueFolder);
  } catch (error) {
    return driveFailure(error);
  }
}

/**
 * Remembers the League folder an Official picked, then fetches from it. It
 * must be one of the Swim folder's own folders.
 */
export async function chooseLeagueFolder(
  league: LeagueRef,
  folderId: string,
): Promise<FetchSwimResultsState> {
  const context = await swimFolderContext(league);
  if ("status" in context) return context;
  const { supabase, swimFolderId } = context;

  try {
    const folders = await listFolders(swimFolderId);
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) {
      return {
        status: "error",
        message: "That folder isn't in the Swim folder any more.",
      };
    }
    await rememberLeagueFolder(supabase, league.leagueId, folder.id);
    return await readResultsFile(folder);
  } catch (error) {
    return driveFailure(error);
  }
}

export interface SetSwimFolderState {
  error?: string;
  saved?: boolean;
}

/**
 * Sets, or with an empty link removes, an Organization's Swim folder. Only
 * an Admin may, and the folder must already be shared with the service
 * account, so a wrong link is caught now rather than on race day.
 */
export async function setSwimFolder(
  organizationId: number,
  _prev: SetSwimFolderState,
  formData: FormData,
): Promise<SetSwimFolderState> {
  // Checked here, ahead of RLS, so a non-Admin can't use the service
  // account to learn whether a folder exists.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data: membership } = await supabase
    .from("organization_member")
    .select("is_admin")
    .eq("organization_id", organizationId)
    .eq("user_id", claims?.claims.sub ?? "")
    .maybeSingle();
  if (!membership?.is_admin) {
    return { error: "Only an Admin can set the Swim folder." };
  }

  const link = String(formData.get("link") ?? "").trim();
  if (link === "") {
    const { error } = await supabase
      .from("swim_folder")
      .delete()
      .eq("organization_id", organizationId);
    if (error) return { error: error.message };
    revalidatePath(`/organizations/${organizationId}`);
    return { saved: true };
  }

  const folderId = driveFolderId(link);
  if (!folderId) return { error: "That isn't a Google Drive folder link." };

  try {
    await folderInfo(folderId);
  } catch (error) {
    return { error: driveFailure(error).message };
  }

  const { error } = await supabase
    .from("swim_folder")
    .upsert({ organization_id: organizationId, drive_folder_id: folderId });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Another Organization already uses that folder."
          : error.message,
    };
  }

  revalidatePath(`/organizations/${organizationId}`);
  return { saved: true };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Who may fetch, and from where. Drive is read as the service account,
 * not the Member, so the Official check happens here rather than in RLS.
 */
async function swimFolderContext(league: LeagueRef): Promise<
  | Extract<FetchSwimResultsState, { status: "error" | "no-swim-folder" }>
  | {
      supabase: Supabase;
      swimFolderId: string;
      leagueName: string;
      leagueDate: string;
    }
> {
  const access = await getLeagueAccess(league.organizationId, league.leagueId);
  if (!access || !canUse(access, "swim")) {
    return { status: "error", message: "Only an Official can fetch swims." };
  }

  const supabase = await createClient();
  const [{ data: leagueRow }, { data: swimFolder }] = await Promise.all([
    supabase
      .from("league")
      .select("name, league_date")
      .eq("id", league.leagueId)
      .single(),
    supabase
      .from("swim_folder")
      .select("drive_folder_id")
      .eq("organization_id", league.organizationId)
      .maybeSingle(),
  ]);
  if (!leagueRow) {
    return { status: "error", message: "That league doesn't exist." };
  }
  if (!swimFolder) return { status: "no-swim-folder" };

  return {
    supabase,
    swimFolderId: swimFolder.drive_folder_id,
    leagueName: leagueRow.name,
    leagueDate: leagueRow.league_date,
  };
}

async function rememberLeagueFolder(
  supabase: Supabase,
  leagueId: number,
  folderId: string,
) {
  const { error } = await supabase
    .from("league_folder")
    .upsert({ league_id: leagueId, drive_folder_id: folderId });
  // Not remembering only means finding it by name again next time.
  if (error) console.error("swim: remember league folder", error);
}

async function readResultsFile(
  leagueFolder: DriveItem,
): Promise<FetchSwimResultsState> {
  const file = pickResultsFile(await listFiles(leagueFolder.id));
  if (!file) return { status: "no-file", leagueFolder };
  const text = await downloadText(file.id);
  return {
    status: "fetched",
    leagueFolder: { id: leagueFolder.id, name: leagueFolder.name },
    file: {
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      text,
    },
    fetchedAt: new Date().toISOString(),
  };
}

function driveFailure(error: unknown): { status: "error"; message: string } {
  if (error instanceof DriveError) {
    return { status: "error", message: error.message };
  }
  console.error("swim: drive", error);
  return { status: "error", message: "Something went wrong reading Drive." };
}
