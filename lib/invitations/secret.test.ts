import { describe, expect, it } from "vitest";

import { createInvitationSecret, hashInvitationSecret } from "./secret";

describe("invitation secrets", () => {
  it("hashes to a stable sha-256 hex digest", () => {
    expect(hashInvitationSecret("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("returns a secret whose hash is the stored one", () => {
    const { secret, hash } = createInvitationSecret();
    expect(hashInvitationSecret(secret)).toBe(hash);
    expect(hash).not.toContain(secret);
  });

  it("makes long, unique, URL-safe secrets", () => {
    const secrets = new Set(
      Array.from({ length: 50 }, () => createInvitationSecret().secret),
    );
    expect(secrets.size).toBe(50);
    for (const secret of secrets) {
      expect(secret).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    }
  });
});
