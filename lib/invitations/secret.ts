import { createHash, randomBytes } from "node:crypto";

/** The hash of an Invitation link's secret: all the database ever stores. */
export function hashInvitationSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** A fresh secret for an Invitation link, with the hash to store for it. */
export function createInvitationSecret(): { secret: string; hash: string } {
  const secret = randomBytes(32).toString("base64url");
  return { secret, hash: hashInvitationSecret(secret) };
}
