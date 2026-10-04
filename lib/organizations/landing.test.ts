import { describe, expect, it } from "vitest";

import { resolveLanding } from "@/lib/organizations/landing";

describe("resolveLanding", () => {
  it("returns the remembered Organization when the user is still a Member", () => {
    expect(resolveLanding([1, 2, 3], 2)).toBe(2);
  });

  it("ignores a remembered Organization the user has left", () => {
    expect(resolveLanding([1, 3], 2)).toBe("picker");
    expect(resolveLanding([3], 2)).toBe(3);
  });

  it("returns the only Organization when nothing is remembered", () => {
    expect(resolveLanding([4], null)).toBe(4);
  });

  it("returns the picker for several Organizations with nothing remembered", () => {
    expect(resolveLanding([1, 2], null)).toBe("picker");
  });

  it("returns the picker for no Organizations", () => {
    expect(resolveLanding([], null)).toBe("picker");
  });
});

describe("rememberedOrganizationId", () => {
  it("parses a cookie value, treating anything else as nothing remembered", async () => {
    const { rememberedOrganizationId } =
      await import("@/lib/organizations/landing");
    expect(rememberedOrganizationId("12")).toBe(12);
    expect(rememberedOrganizationId(undefined)).toBeNull();
    expect(rememberedOrganizationId("abc")).toBeNull();
    expect(rememberedOrganizationId("0")).toBeNull();
  });
});
