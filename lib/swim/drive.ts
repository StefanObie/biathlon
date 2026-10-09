import { createSign } from "node:crypto";

import { requireServerEnv } from "@/lib/env";
import type { DriveFile, DriveItem } from "@/lib/swim/drive-folder";

/**
 * Reads Swim folders from Google Drive as the app's one service account
 * (ADR 0005). Talks to Drive's REST API directly: the access token is a
 * signed JWT exchanged at Google's token endpoint, which is all the
 * googleapis package would do for this.
 */

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Something about Drive an Official can act on, worded for them. */
export class DriveError extends Error {}

let cached: { token: string; expiresAt: number } | null = null;

function serviceAccountKey(): { client_email: string; private_key: string } {
  return JSON.parse(requireServerEnv("GOOGLE_SERVICE_ACCOUNT_KEY"));
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  let key: { client_email: string; private_key: string };
  try {
    key = serviceAccountKey();
  } catch (error) {
    console.error("drive: service account key", error);
    throw new DriveError("Drive isn't set up for this app yet.");
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(key.private_key);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
  });
  if (!response.ok) {
    console.error("drive: token", response.status, await response.text());
    throw new DriveError("Couldn't sign in to Drive.");
  }
  const body = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return cached.token;
}

async function driveGet(path: string, params: Record<string, string>) {
  const url = `${FILES_URL}${path}?${new URLSearchParams({
    supportsAllDrives: "true",
    ...params,
  })}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
    cache: "no-store",
  });
  if (response.status === 404) {
    throw new DriveError(
      "Google Drive can't find that folder or file. Check it is shared with the service account.",
    );
  }
  if (!response.ok) {
    console.error("drive:", path, response.status, await response.text());
    throw new DriveError("Google Drive didn't answer. Try again.");
  }
  return response;
}

async function listChildren(
  folderId: string,
  kind: "folders" | "files",
): Promise<DriveFile[]> {
  const items: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const response = await driveGet("", {
      q: `'${folderId}' in parents and trashed = false and mimeType ${
        kind === "folders" ? "=" : "!="
      } '${FOLDER_MIME}'`,
      fields: "nextPageToken, files(id, name, modifiedTime)",
      includeItemsFromAllDrives: "true",
      pageSize: "200",
      ...(pageToken ? { pageToken } : {}),
    });
    const body = (await response.json()) as {
      files: DriveFile[];
      nextPageToken?: string;
    };
    items.push(...body.files);
    pageToken = body.nextPageToken;
  } while (pageToken);
  return items;
}

/** The folders directly inside a folder: a Swim folder's League folders. */
export function listFolders(folderId: string): Promise<DriveItem[]> {
  return listChildren(folderId, "folders");
}

/** The files directly inside a folder: a League folder's files. */
export function listFiles(folderId: string): Promise<DriveFile[]> {
  return listChildren(folderId, "files");
}

/** A folder's name and the folders it sits in. A file isn't a folder. */
export async function folderInfo(
  folderId: string,
): Promise<{ name: string; parents: string[] }> {
  const response = await driveGet(`/${folderId}`, {
    fields: "name, parents, mimeType",
  });
  const body = (await response.json()) as {
    name: string;
    parents?: string[];
    mimeType: string;
  };
  if (body.mimeType !== FOLDER_MIME) {
    throw new DriveError(`"${body.name}" is a file, not a folder.`);
  }
  return { name: body.name, parents: body.parents ?? [] };
}

/** A file's contents as text. */
export async function downloadText(fileId: string): Promise<string> {
  const response = await driveGet(`/${fileId}`, { alt: "media" });
  return response.text();
}

/** The service account's email, for Admins to share their Swim folder with. */
export function serviceAccountEmail(): string | null {
  try {
    const { client_email } = serviceAccountKey();
    return typeof client_email === "string" ? client_email : null;
  } catch {
    return null;
  }
}
