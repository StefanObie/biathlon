import { describe, expect, it } from "vitest";

import {
  buildWorkingRows,
  computeAutomaticChecks,
  mismatchFor,
  type PositionEntry,
  type TimeEntry,
} from "./join";

describe("buildWorkingRows", () => {
  it("zips position and time streams by ordinal", () => {
    const positions: PositionEntry[] = [
      { id: "p1", position: 1, athleteNo: 7409 },
      { id: "p2", position: 2, athleteNo: 8081 },
    ];
    const times: TimeEntry[] = [
      { id: "t1", seq: 1, elapsedTime: "01:47.03", isPlaceholder: false },
      { id: "t2", seq: 2, elapsedTime: "01:49.55", isPlaceholder: false },
    ];
    const names = new Map([
      [7409, "Athlete R"],
      [8081, "Athlete S"],
    ]);

    const rows = buildWorkingRows(positions, times, names);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      athleteNo: 7409,
      athleteName: "Athlete R",
      runTime: "01:47.03",
      status: "ok",
    });
    expect(rows[1]).toMatchObject({
      athleteNo: 8081,
      athleteName: "Athlete S",
      runTime: "01:49.55",
    });
  });

  it("pads the shorter stream so both are fully represented", () => {
    const positions: PositionEntry[] = [
      { id: "p1", position: 1, athleteNo: 7409 },
      { id: "p2", position: 2, athleteNo: 8081 },
    ];
    const times: TimeEntry[] = [
      { id: "t1", seq: 1, elapsedTime: "01:47.03", isPlaceholder: false },
    ];

    const rows = buildWorkingRows(positions, times, new Map());

    expect(rows).toHaveLength(2);
    expect(rows[1].time).toBeNull();
    expect(rows[1].runTime).toBeNull();
  });

  it("leaves runTime null for a skip (no athlete captured)", () => {
    const positions: PositionEntry[] = [
      { id: "p1", position: 1, athleteNo: null },
    ];
    const times: TimeEntry[] = [
      { id: "t1", seq: 1, elapsedTime: "01:52.10", isPlaceholder: false },
    ];

    const rows = buildWorkingRows(positions, times, new Map());

    expect(rows[0].athleteNo).toBeNull();
    expect(rows[0].runTime).toBe("01:52.10");
  });

  it("leaves runTime null for a placeholder (missed press)", () => {
    const positions: PositionEntry[] = [
      { id: "p1", position: 1, athleteNo: 8207 },
    ];
    const times: TimeEntry[] = [
      { id: "t1", seq: 1, elapsedTime: "00:00.00", isPlaceholder: true },
    ];

    const rows = buildWorkingRows(
      positions,
      times,
      new Map([[8207, "Athlete T"]]),
    );

    expect(rows[0].runTime).toBeNull();
  });
});

describe("mismatchFor", () => {
  const base = {
    localId: "x",
    athleteNo: 1,
    athleteName: "A",
    runTime: "01:00.00",
    status: "ok" as const,
  };

  it("flags a gap row with neither position nor time, athlete, or time entered", () => {
    expect(
      mismatchFor({
        ...base,
        athleteNo: null,
        athleteName: null,
        runTime: null,
        position: null,
        time: null,
      }),
    ).toBe("gap");
  });

  it("flags skip-at-table when no athlete is assigned", () => {
    expect(
      mismatchFor({
        ...base,
        athleteNo: null,
        athleteName: null,
        position: { id: "p", position: 1, athleteNo: null },
        time: {
          id: "t",
          seq: 1,
          elapsedTime: "01:00.00",
          isPlaceholder: false,
        },
      }),
    ).toBe("skip-at-table");
  });

  it("resolves skip-at-table once the operator assigns an athlete", () => {
    expect(
      mismatchFor({
        ...base,
        position: { id: "p", position: 1, athleteNo: null },
        time: {
          id: "t",
          seq: 1,
          elapsedTime: "01:00.00",
          isPlaceholder: false,
        },
      }),
    ).toBeNull();
  });

  it("flags placeholder-needs-time when time is a placeholder", () => {
    expect(
      mismatchFor({
        ...base,
        runTime: null,
        position: { id: "p", position: 1, athleteNo: 1 },
        time: { id: "t", seq: 1, elapsedTime: "00:00.00", isPlaceholder: true },
      }),
    ).toBe("placeholder-needs-time");
  });

  it("resolves placeholder-needs-time once the operator enters a time", () => {
    expect(
      mismatchFor({
        ...base,
        position: { id: "p", position: 1, athleteNo: 1 },
        time: { id: "t", seq: 1, elapsedTime: "00:00.00", isPlaceholder: true },
      }),
    ).toBeNull();
  });

  it("flags position-without-time when the time stream ran short", () => {
    expect(
      mismatchFor({
        ...base,
        runTime: null,
        position: { id: "p", position: 1, athleteNo: 1 },
        time: null,
      }),
    ).toBe("position-without-time");
  });

  it("resolves position-without-time once the operator enters a time by hand", () => {
    expect(
      mismatchFor({
        ...base,
        position: { id: "p", position: 1, athleteNo: 1 },
        time: null,
      }),
    ).toBeNull();
  });

  it("flags time-without-position when the position stream ran short", () => {
    expect(
      mismatchFor({
        ...base,
        athleteNo: null,
        athleteName: null,
        position: null,
        time: {
          id: "t",
          seq: 1,
          elapsedTime: "01:00.00",
          isPlaceholder: false,
        },
      }),
    ).toBe("time-without-position");
  });

  it("resolves time-without-position once the operator assigns an athlete", () => {
    expect(
      mismatchFor({
        ...base,
        position: null,
        time: {
          id: "t",
          seq: 1,
          elapsedTime: "01:00.00",
          isPlaceholder: false,
        },
      }),
    ).toBeNull();
  });

  it("returns null when both streams agree", () => {
    expect(
      mismatchFor({
        ...base,
        position: { id: "p", position: 1, athleteNo: 1 },
        time: {
          id: "t",
          seq: 1,
          elapsedTime: "01:00.00",
          isPlaceholder: false,
        },
      }),
    ).toBeNull();
  });

  it("treats a partially-filled gap as the matching single-sided mismatch", () => {
    const gap = {
      ...base,
      athleteNo: null,
      athleteName: null,
      runTime: null,
      position: null,
      time: null,
    };
    expect(mismatchFor({ ...gap, athleteNo: 1, athleteName: "A" })).toBe(
      "position-without-time",
    );
    expect(mismatchFor({ ...gap, runTime: "01:00.00" })).toBe(
      "time-without-position",
    );
  });
});

describe("computeAutomaticChecks", () => {
  const okRow = {
    localId: "1",
    position: { id: "p", position: 1, athleteNo: 7409 },
    time: { id: "t", seq: 1, elapsedTime: "01:47.03", isPlaceholder: false },
    athleteNo: 7409,
    athleteName: "Athlete R",
    runTime: "01:47.03",
    status: "ok" as const,
  };

  it("flags a captured-vs-roster count mismatch", () => {
    const checks = computeAutomaticChecks({
      rosterCount: 2,
      rows: [okRow],
      rosterAthleteNos: new Set([7409, 8081]),
      duplicateAthletes: [],
    });
    expect(checks.some((c) => c.kind === "count-mismatch")).toBe(true);
  });

  it("flags an athlete captured but not on this heat's roster", () => {
    const checks = computeAutomaticChecks({
      rosterCount: 1,
      rows: [okRow],
      rosterAthleteNos: new Set([9999]),
      duplicateAthletes: [],
    });
    expect(checks.some((c) => c.kind === "not-on-roster")).toBe(true);
  });

  it("flags an athlete who already has a time in another heat", () => {
    const checks = computeAutomaticChecks({
      rosterCount: 1,
      rows: [okRow],
      rosterAthleteNos: new Set([7409]),
      duplicateAthletes: [{ athleteNo: 7409, otherHeat: 3 }],
    });
    expect(checks.some((c) => c.kind === "duplicate-heat")).toBe(true);
  });

  it("has no checks when everything lines up", () => {
    const checks = computeAutomaticChecks({
      rosterCount: 1,
      rows: [okRow],
      rosterAthleteNos: new Set([7409]),
      duplicateAthletes: [],
    });
    expect(checks).toHaveLength(0);
  });
});
