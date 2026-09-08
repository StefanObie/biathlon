import { describe, expect, it } from "vitest";

import { parseBibPayload } from "./payload";

describe("parseBibPayload", () => {
  it("extracts the athlete number from a valid bib payload", () => {
    expect(parseBibPayload("BCL-7409")).toBe(7409);
  });

  it("rejects payloads without the bib prefix", () => {
    expect(parseBibPayload("7409")).toBeNull();
    expect(parseBibPayload("https://example.com")).toBeNull();
  });

  it("rejects a prefix with non-numeric or empty content", () => {
    expect(parseBibPayload("BCL-")).toBeNull();
    expect(parseBibPayload("BCL-74O9")).toBeNull();
    expect(parseBibPayload("BCL--7409")).toBeNull();
  });
});
