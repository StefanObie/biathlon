import { describe, expect, it } from "vitest";

import { captureScreenState, heatRosterSize } from "./screen-state";

/** A time capture as the Timer screen holds it, trimmed to what matters here. */
function timeCapture(fields: { is_placeholder?: boolean; voided?: boolean }) {
  return {
    id: "01J",
    seq: 1,
    elapsed_time: "01:23.45",
    is_placeholder: fields.is_placeholder ?? false,
    voided: fields.voided ?? false,
  };
}

/** A position capture as the Position screen holds it. */
function positionCapture(fields: {
  athlete_no?: number | null;
  voided?: boolean;
}) {
  return {
    id: "01J",
    position: 1,
    athlete_no: fields.athlete_no ?? 101,
    voided: fields.voided ?? false,
  };
}

describe("captureScreenState", () => {
  it("counts no finishers on a fresh heat", () => {
    expect(
      captureScreenState({
        captures: [],
        rosterSize: 20,
        closedAt: null,
        startedAtMs: null,
      }),
    ).toEqual({
      finished: 0,
      rosterSize: 20,
      overRoster: false,
      locked: false,
      frozenElapsedMs: null,
    });
  });

  it("counts every active capture as a finisher", () => {
    // Missed finishes (time) and Skips (position) are ordinary active
    // captures — they mark a finisher whose time or identity is missing,
    // not the absence of a finisher.
    const state = captureScreenState({
      captures: [{ voided: false }, { voided: false }, { voided: false }],
      rosterSize: 20,
      closedAt: null,
      startedAtMs: null,
    });
    expect(state.finished).toBe(3);
  });

  it("counts a Missed finish as a finisher", () => {
    // A Missed finish marks a finisher the timekeeper failed to press for:
    // a finisher with no usable time, not the absence of one.
    const state = captureScreenState({
      captures: [
        timeCapture({}),
        timeCapture({ is_placeholder: true }),
        timeCapture({}),
      ],
      rosterSize: 20,
      closedAt: null,
      startedAtMs: null,
    });
    expect(state.finished).toBe(3);
  });

  it("counts a Skip as a finisher", () => {
    // A Skip marks a finisher whose bib couldn't be scanned in order.
    const state = captureScreenState({
      captures: [
        positionCapture({}),
        positionCapture({ athlete_no: null }),
        positionCapture({}),
      ],
      rosterSize: 20,
      closedAt: null,
      startedAtMs: null,
    });
    expect(state.finished).toBe(3);
  });

  it("leaves a voided Missed finish or Skip out of the count", () => {
    const state = captureScreenState({
      captures: [
        timeCapture({ is_placeholder: true, voided: true }),
        positionCapture({ athlete_no: null, voided: true }),
        positionCapture({}),
      ],
      rosterSize: 20,
      closedAt: null,
      startedAtMs: null,
    });
    expect(state.finished).toBe(1);
  });

  it("leaves voided captures out of the count", () => {
    const state = captureScreenState({
      captures: [{ voided: false }, { voided: true }, { voided: false }],
      rosterSize: 20,
      closedAt: null,
      startedAtMs: null,
    });
    expect(state.finished).toBe(2);
  });

  it("is not over the roster when the count equals the roster size", () => {
    const state = captureScreenState({
      captures: Array.from({ length: 20 }, () => ({ voided: false })),
      rosterSize: 20,
      closedAt: null,
      startedAtMs: null,
    });
    expect(state).toEqual({
      finished: 20,
      rosterSize: 20,
      overRoster: false,
      locked: false,
      frozenElapsedMs: null,
    });
  });

  it("is over the roster when the count exceeds the roster size", () => {
    // An athlete scanned from another heat counts as a finisher but is not
    // on this heat's roster, so 21 / 20 is reachable and worth warning about.
    const state = captureScreenState({
      captures: Array.from({ length: 21 }, () => ({ voided: false })),
      rosterSize: 20,
      closedAt: null,
      startedAtMs: null,
    });
    expect(state).toEqual({
      finished: 21,
      rosterSize: 20,
      overRoster: true,
      locked: false,
      frozenElapsedMs: null,
    });
  });
});

describe("captureScreenState locked", () => {
  it("is locked when the heat is closed", () => {
    const state = captureScreenState({
      captures: [],
      rosterSize: 20,
      closedAt: "2026-09-28T10:15:00.000Z",
      startedAtMs: null,
    });
    expect(state.locked).toBe(true);
  });

  it("is not locked when the heat is open", () => {
    // A reopened heat has no close time, so it unlocks the same way.
    const state = captureScreenState({
      captures: [],
      rosterSize: 20,
      closedAt: null,
      startedAtMs: null,
    });
    expect(state.locked).toBe(false);
  });

  it("still counts finishers on a closed heat", () => {
    const state = captureScreenState({
      captures: [{ voided: false }, { voided: true }],
      rosterSize: 20,
      closedAt: "2026-09-28T10:15:00.000Z",
      startedAtMs: null,
    });
    expect(state).toEqual({
      finished: 1,
      rosterSize: 20,
      overRoster: false,
      locked: true,
      frozenElapsedMs: null,
    });
  });
});

describe("captureScreenState frozenElapsedMs", () => {
  const startedAtMs = Date.parse("2026-09-28T10:00:00.000Z");

  it("freezes the clock at the time between the start and the close", () => {
    const state = captureScreenState({
      captures: [],
      rosterSize: 20,
      closedAt: "2026-09-28T10:15:30.250Z",
      startedAtMs,
    });
    expect(state.frozenElapsedMs).toBe(15 * 60_000 + 30_250);
  });

  it("is null while the heat is open, so the clock runs", () => {
    const state = captureScreenState({
      captures: [],
      rosterSize: 20,
      closedAt: null,
      startedAtMs,
    });
    expect(state.frozenElapsedMs).toBeNull();
  });

  it("is null when the heat closed without a start", () => {
    const state = captureScreenState({
      captures: [],
      rosterSize: 20,
      closedAt: "2026-09-28T10:15:00.000Z",
      startedAtMs: null,
    });
    expect(state.frozenElapsedMs).toBeNull();
  });

  it("never goes below zero when the clocks disagree", () => {
    // The close time comes from the official's device and the start from
    // the timer phone, so a close can appear to land before the start.
    const state = captureScreenState({
      captures: [],
      rosterSize: 20,
      closedAt: "2026-09-28T09:59:59.000Z",
      startedAtMs,
    });
    expect(state.frozenElapsedMs).toBe(0);
  });
});

describe("heatRosterSize", () => {
  it("counts only the entries in this heat", () => {
    expect(heatRosterSize([1, 1, 2, 3, 1], 1)).toBe(3);
  });

  it("is zero for a heat with no entries", () => {
    expect(heatRosterSize([1, 2], 3)).toBe(0);
  });
});
