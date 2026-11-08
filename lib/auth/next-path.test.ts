import { describe, expect, it } from "vitest";

import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps a path on this site, with its query", () => {
    expect(safeNextPath("/auth/invitation?token=abc")).toBe(
      "/auth/invitation?token=abc",
    );
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNextPath("https://evil.example/x")).toBeNull();
    expect(safeNextPath("//evil.example/x")).toBeNull();
    expect(safeNextPath("/\\evil.example/x")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("refuses a path whose dot segments make it leave the site", () => {
    expect(safeNextPath("/..//evil.example/x")).toBeNull();
    expect(safeNextPath("/.//evil.example/x")).toBeNull();
    expect(safeNextPath("/a/..//evil.example/x")).toBeNull();
  });

  it("has nothing to return to without a path", () => {
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
