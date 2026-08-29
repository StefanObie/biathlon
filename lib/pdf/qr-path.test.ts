import { describe, expect, it } from "vitest";

import { buildQrPath } from "./qr-path";

describe("buildQrPath", () => {
  it("produces a non-empty path and a square module grid", () => {
    const { path, size } = buildQrPath("SAB-7409");
    expect(size).toBeGreaterThan(0);
    expect(path.length).toBeGreaterThan(0);
    expect(path).toMatch(/^(M\d+,\d+h1v1h-1z)+$/);
  });

  it("produces different paths for different payloads", () => {
    const a = buildQrPath("SAB-7409");
    const b = buildQrPath("SAB-8124");
    expect(a.path).not.toEqual(b.path);
  });
});
