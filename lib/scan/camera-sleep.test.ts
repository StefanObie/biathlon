import { describe, expect, it } from "vitest";

import { nextCameraState, wokenAt } from "./camera-sleep";

describe("nextCameraState", () => {
  it("keeps an unused camera awake until 45 seconds have passed", () => {
    const awake = wokenAt(0);

    expect(nextCameraState(awake, { type: "tick", at: 44_999 }).awake).toBe(
      true,
    );
  });

  it("puts the camera to sleep 45 seconds after it woke without a scan or entry", () => {
    const awake = wokenAt(0);

    expect(nextCameraState(awake, { type: "tick", at: 45_000 }).awake).toBe(
      false,
    );
  });

  it("restarts the 45 seconds from each scan or manual entry", () => {
    const used = nextCameraState(wokenAt(0), { type: "used", at: 30_000 });

    expect(nextCameraState(used, { type: "tick", at: 74_999 }).awake).toBe(
      true,
    );
    expect(nextCameraState(used, { type: "tick", at: 75_000 }).awake).toBe(
      false,
    );
  });

  it("leaves a sleeping camera asleep when an athlete number is typed in", () => {
    const asleep = nextCameraState(wokenAt(0), { type: "tick", at: 45_000 });

    expect(nextCameraState(asleep, { type: "used", at: 50_000 }).awake).toBe(
      false,
    );
  });

  it("puts the camera to sleep as soon as the page is hidden", () => {
    expect(nextCameraState(wokenAt(0), { type: "hidden" }).awake).toBe(false);
  });

  it("wakes a sleeping camera on a tap, with a fresh 45 seconds", () => {
    const asleep = nextCameraState(wokenAt(0), { type: "hidden" });
    const woken = nextCameraState(asleep, { type: "wake", at: 100_000 });

    expect(nextCameraState(woken, { type: "tick", at: 144_999 }).awake).toBe(
      true,
    );
    expect(nextCameraState(woken, { type: "tick", at: 145_000 }).awake).toBe(
      false,
    );
  });
});
