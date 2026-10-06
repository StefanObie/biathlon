import { describe, expect, it } from "vitest";

import {
  authorOffTeamChecks,
  buildWorkingRows,
  capturedAfterCloseChecks,
  computeAutomaticChecks,
  lateEntriesToConfirm,
  mismatchFor,
  type WorkingRow,
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
      startListAthleteNos: new Set([7409, 8081]),
      duplicateAthletes: [],
    });
    expect(checks.some((c) => c.kind === "count-mismatch")).toBe(true);
  });

  it("flags an athlete captured but not on this heat's roster", () => {
    const checks = computeAutomaticChecks({
      rosterCount: 1,
      rows: [okRow],
      rosterAthleteNos: new Set([9999]),
      startListAthleteNos: new Set([7409, 9999]),
      duplicateAthletes: [],
    });
    expect(checks.some((c) => c.kind === "not-on-roster")).toBe(true);
  });

  it("flags an athlete who already has a time in another heat", () => {
    const checks = computeAutomaticChecks({
      rosterCount: 1,
      rows: [okRow],
      rosterAthleteNos: new Set([7409]),
      startListAthleteNos: new Set([7409]),
      duplicateAthletes: [{ athleteNo: 7409, otherHeat: 3 }],
    });
    expect(checks.some((c) => c.kind === "duplicate-heat")).toBe(true);
  });

  it("flags an athlete captured who isn't on the Start list, not as off the roster", () => {
    const checks = computeAutomaticChecks({
      rosterCount: 1,
      rows: [{ ...okRow, athleteNo: 6918 }],
      rosterAthleteNos: new Set([7409]),
      startListAthleteNos: new Set([7409]),
      duplicateAthletes: [],
    });
    expect(checks.filter((c) => c.kind !== "count-mismatch")).toEqual([
      { kind: "not-on-start-list", message: "#6918 is not on the Start list." },
    ]);
  });

  it("has no checks when everything lines up", () => {
    const checks = computeAutomaticChecks({
      rosterCount: 1,
      rows: [okRow],
      rosterAthleteNos: new Set([7409]),
      startListAthleteNos: new Set([7409]),
      duplicateAthletes: [],
    });
    expect(checks).toHaveLength(0);
  });
});

describe("capturedAfterCloseChecks", () => {
  const closedAt = "2026-09-28T10:15:00.000Z";

  it("flags a position capture made after the heat closed", () => {
    const checks = capturedAfterCloseChecks({
      closedAt,
      positions: [
        {
          position: 21,
          athleteNo: 7409,
          capturedAt: "2026-09-28T10:16:00.000Z",
          voided: false,
        },
      ],
      times: [],
    });
    expect(checks).toEqual([
      {
        kind: "captured-after-close",
        message: "Position #21 (athlete 7409) was captured after heat closed.",
      },
    ]);
  });

  it("flags a time capture made after the heat closed", () => {
    const checks = capturedAfterCloseChecks({
      closedAt,
      positions: [],
      times: [
        { seq: 21, capturedAt: "2026-09-28T10:16:00.000Z", voided: false },
      ],
    });
    expect(checks).toEqual([
      {
        kind: "captured-after-close",
        message: "Time #21 was captured after heat closed.",
      },
    ]);
  });

  it("names a Skip made after the heat closed", () => {
    const checks = capturedAfterCloseChecks({
      closedAt,
      positions: [
        {
          position: 3,
          athleteNo: null,
          capturedAt: "2026-09-28T10:16:00.000Z",
          voided: false,
        },
      ],
      times: [],
    });
    expect(checks[0].message).toBe(
      "Position #3 (skip) was captured after heat closed.",
    );
  });

  it("does not flag captures made at or before the close", () => {
    // A phone that was offline syncs late, but its captures were made
    // before the close — only when a capture was made counts.
    const checks = capturedAfterCloseChecks({
      closedAt,
      positions: [
        {
          position: 1,
          athleteNo: 7409,
          capturedAt: "2026-09-28T10:14:59.990Z",
          voided: false,
        },
        {
          position: 2,
          athleteNo: 8081,
          capturedAt: closedAt,
          voided: false,
        },
      ],
      times: [{ seq: 1, capturedAt: closedAt, voided: false }],
    });
    expect(checks).toEqual([]);
  });

  it("compares instants, not how the timestamp is written", () => {
    // Supabase returns offsets; phones write Z. 12:14+02:00 is 10:14 UTC,
    // before the close, even though the string sorts after it.
    const checks = capturedAfterCloseChecks({
      closedAt,
      positions: [],
      times: [
        { seq: 1, capturedAt: "2026-09-28T12:14:00+02:00", voided: false },
      ],
    });
    expect(checks).toEqual([]);
  });

  it("does not flag voided captures", () => {
    const checks = capturedAfterCloseChecks({
      closedAt,
      positions: [],
      times: [{ seq: 2, capturedAt: "2026-09-28T10:16:00.000Z", voided: true }],
    });
    expect(checks).toEqual([]);
  });

  it("flags nothing on an open heat", () => {
    const checks = capturedAfterCloseChecks({
      closedAt: null,
      positions: [
        {
          position: 1,
          athleteNo: 7409,
          capturedAt: "2026-09-28T10:16:00.000Z",
          voided: false,
        },
      ],
      times: [
        { seq: 1, capturedAt: "2026-09-28T10:16:00.000Z", voided: false },
      ],
    });
    expect(checks).toEqual([]);
  });
});

describe("authorOffTeamChecks", () => {
  const onTeam = new Set(["still-on"]);

  it("flags captures whose author is no longer on the League team", () => {
    const checks = authorOffTeamChecks({
      onTeam,
      positions: [
        { position: 4, athleteNo: 7409, authorId: "removed", voided: false },
        { position: 5, athleteNo: null, authorId: "removed", voided: false },
      ],
      times: [{ seq: 4, authorId: "removed", voided: false }],
    });
    expect(checks).toEqual([
      {
        kind: "author-off-team",
        message:
          "Position #4 (athlete 7409) was captured by someone no longer on the League team.",
      },
      {
        kind: "author-off-team",
        message:
          "Position #5 (skip) was captured by someone no longer on the League team.",
      },
      {
        kind: "author-off-team",
        message:
          "Time #4 was captured by someone no longer on the League team.",
      },
    ]);
  });

  it("does not flag captures by someone still on the team", () => {
    const checks = authorOffTeamChecks({
      onTeam,
      positions: [
        { position: 1, athleteNo: 7409, authorId: "still-on", voided: false },
      ],
      times: [{ seq: 1, authorId: "still-on", voided: false }],
    });
    expect(checks).toEqual([]);
  });

  it("does not flag captures with no author, made before authors were recorded", () => {
    const checks = authorOffTeamChecks({
      onTeam,
      positions: [
        { position: 1, athleteNo: 7409, authorId: null, voided: false },
      ],
      times: [{ seq: 1, authorId: null, voided: false }],
    });
    expect(checks).toEqual([]);
  });

  it("does not flag voided captures", () => {
    const checks = authorOffTeamChecks({
      onTeam,
      positions: [],
      times: [{ seq: 1, authorId: "removed", voided: true }],
    });
    expect(checks).toEqual([]);
  });
});

describe("lateEntriesToConfirm", () => {
  const row = (athleteNo: number | null): WorkingRow => ({
    localId: `row-${athleteNo}`,
    position: null,
    time: null,
    athleteNo,
    athleteName: null,
    runTime: "01:47.03",
    status: "ok",
  });
  const athletes = [
    {
      athleteNo: 6918,
      fullName: "Athlete A",
      gender: "F" as const,
      latestAgeGroupCode: "U13",
    },
    {
      athleteNo: 5478,
      fullName: "Athlete B",
      gender: "M" as const,
      latestAgeGroupCode: null,
    },
    {
      athleteNo: 7409,
      fullName: "Athlete R",
      gender: "M" as const,
      latestAgeGroupCode: "SEN",
    },
  ];

  it("lists each athlete not on the Start list, in this heat, with their latest age group", () => {
    expect(
      lateEntriesToConfirm({
        rows: [row(7409), row(6918), row(null), row(5478)],
        runHeat: 4,
        startListAthleteNos: new Set([7409]),
        athletes,
      }),
    ).toEqual([
      {
        athleteNo: 6918,
        fullName: "Athlete A",
        gender: "F",
        runHeat: 4,
        suggestedAgeGroupLabel: "U/13 GIRLS",
      },
      {
        athleteNo: 5478,
        fullName: "Athlete B",
        gender: "M",
        runHeat: 4,
        suggestedAgeGroupLabel: null,
      },
    ]);
  });

  it("lists an athlete on two rows once", () => {
    expect(
      lateEntriesToConfirm({
        rows: [row(6918), row(6918)],
        runHeat: 4,
        startListAthleteNos: new Set(),
        athletes,
      }).map((e) => e.athleteNo),
    ).toEqual([6918]);
  });

  it("lists no one for a number that is no athlete of the Organization", () => {
    expect(
      lateEntriesToConfirm({
        rows: [row(1234)],
        runHeat: 4,
        startListAthleteNos: new Set(),
        athletes,
      }),
    ).toEqual([]);
  });

  it("lists nothing when everyone is on the Start list", () => {
    expect(
      lateEntriesToConfirm({
        rows: [row(7409)],
        runHeat: 4,
        startListAthleteNos: new Set([7409]),
        athletes,
      }),
    ).toEqual([]);
  });
});
