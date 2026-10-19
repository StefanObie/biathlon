import { describe, expect, it } from "vitest";

import { FILLED } from "@/lib/scan/position";

import {
  openReconciliation,
  reconciliationPayload,
  rowChanges,
  runTimeInput,
  unplacedCaptures,
  voidedCapture,
  type PositionCaptureFacts,
  type TimeCaptureFacts,
} from "./reconciliation";

const names = new Map([
  [12, "Scanned Athlete"],
  [34, "Actual Athlete"],
  [56, "Added Athlete"],
]);

function position(
  id: string,
  pos: number,
  athleteNo: number | null,
  extra: Partial<PositionCaptureFacts> = {},
): PositionCaptureFacts {
  return {
    id,
    position: pos,
    athleteNo,
    voided: false,
    voidReason: null,
    ...extra,
  };
}

function time(
  id: string,
  seq: number,
  elapsedTime: string,
  extra: Partial<TimeCaptureFacts> = {},
): TimeCaptureFacts {
  return {
    id,
    seq,
    elapsedTime,
    isPlaceholder: false,
    voided: false,
    ...extra,
  };
}

describe("openReconciliation", () => {
  it("opens a saved heat from its saved Reconciliation, not from the Captures", () => {
    const rows = openReconciliation({
      saved: [
        {
          athleteNo: 34,
          runTime: "02:30.90",
          status: "ok",
          positionCaptureId: "p1",
          timeCaptureId: "t1",
        },
        {
          athleteNo: 56,
          runTime: "02:40.00",
          status: "ok",
          positionCaptureId: null,
          timeCaptureId: null,
        },
      ],
      positions: [position("p1", 1, 12)],
      times: [time("t1", 1, "02:31.10")],
      runResults: [],
      names,
    });

    expect(rows).toMatchObject([
      {
        athleteNo: 34,
        athleteName: "Actual Athlete",
        runTime: "02:30.90",
        status: "ok",
        position: { id: "p1", athleteNo: 12 },
        time: { id: "t1", elapsedTime: "02:31.10" },
      },
      {
        athleteNo: 56,
        athleteName: "Added Athlete",
        runTime: "02:40.00",
        position: null,
        time: null,
      },
    ]);
  });

  it("opens a heat saved before Reconciliations were stored from its Captures, with its Run results laid over them", () => {
    const rows = openReconciliation({
      saved: [],
      positions: [
        position("p0", 1, 99, { voided: true }),
        position("p1", 1, 12),
        position("p2", 2, 34),
      ],
      times: [time("t1", 1, "02:31.10"), time("t2", 2, "02:35.00")],
      runResults: [
        { athleteNo: 12, runTime: "02:30.90", status: "ok" },
        { athleteNo: 56, runTime: "02:40.00", status: "ok" },
      ],
      names,
    });

    expect(rows).toMatchObject([
      { athleteNo: 12, runTime: "02:30.90", position: { id: "p1" } },
      { athleteNo: 34, runTime: "02:35.00", position: { id: "p2" } },
      {
        athleteNo: 56,
        athleteName: "Added Athlete",
        runTime: "02:40.00",
        position: null,
        time: null,
        savedWithoutCapture: true,
      },
    ]);
  });
});

describe("unplacedCaptures", () => {
  it("lists the active Captures no row of the Reconciliation came from", () => {
    const positions = [
      position("p0", 2, 77, { voided: true }),
      position("p1", 1, 12),
      position("p2", 2, 34),
    ];
    const times = [time("t1", 1, "02:31.10"), time("t2", 2, "02:35.00")];
    const rows = openReconciliation({
      saved: [
        {
          athleteNo: 12,
          runTime: "02:31.10",
          status: "ok",
          positionCaptureId: "p1",
          timeCaptureId: "t1",
        },
      ],
      positions,
      times,
      runResults: [],
      names,
    });

    expect(unplacedCaptures(rows, positions, times)).toEqual({
      positions: [{ id: "p2", position: 2, athleteNo: 34 }],
      times: [
        { id: "t2", seq: 2, elapsedTime: "02:35.00", isPlaceholder: false },
      ],
    });
  });
});

describe("voidedCapture", () => {
  const savedSkipRow = {
    athleteNo: 34,
    runTime: "02:31.10",
    status: "ok" as const,
    positionCaptureId: "p1",
    timeCaptureId: "t1",
  };

  it("keeps a saved row whose Skip was later filled, and offers the Fill", () => {
    const positions = [
      position("p1", 1, null, { voided: true, voidReason: FILLED }),
      position("p1-fill", 1, 34),
    ];
    const times = [time("t1", 1, "02:31.10")];
    const rows = openReconciliation({
      saved: [savedSkipRow],
      positions,
      times,
      runResults: [],
      names,
    });

    expect(rows[0]).toMatchObject({ athleteNo: 34, runTime: "02:31.10" });
    expect(voidedCapture(rows[0], positions, times)).toEqual({
      message: "Its position capture was voided: the Skip was filled with #34.",
      replacement: { id: "p1-fill", position: 1, athleteNo: 34 },
    });
    // The Fill is offered on the row, so it isn't listed again beside it.
    expect(unplacedCaptures(rows, positions, times).positions).toEqual([]);
  });

  it("flags a saved row whose time capture was voided", () => {
    const positions = [position("p1", 1, 34)];
    const times = [time("t1", 1, "02:31.10", { voided: true })];
    const rows = openReconciliation({
      saved: [{ ...savedSkipRow }],
      positions,
      times,
      runResults: [],
      names,
    });

    expect(voidedCapture(rows[0], positions, times)).toEqual({
      message: "Its time capture was voided.",
      replacement: null,
    });
  });

  it("flags nothing when the row's Captures are active", () => {
    const positions = [position("p1", 1, 34)];
    const times = [time("t1", 1, "02:31.10")];
    const rows = openReconciliation({
      saved: [savedSkipRow],
      positions,
      times,
      runResults: [],
      names,
    });

    expect(voidedCapture(rows[0], positions, times)).toBeNull();
  });
});

describe("rowChanges", () => {
  const positions = [position("p1", 1, 12), position("p2", 2, null)];
  const times = [
    time("t1", 1, "02:31.10"),
    time("t2", 2, "00:00.00", { isPlaceholder: true }),
  ];
  const saved = (
    athleteNo: number | null,
    runTime: string | null,
    positionCaptureId: string | null,
    timeCaptureId: string | null,
  ) => ({
    athleteNo,
    runTime,
    status: "ok" as const,
    positionCaptureId,
    timeCaptureId,
  });

  function changesOf(row: ReturnType<typeof saved>) {
    const [opened] = openReconciliation({
      saved: [row],
      positions,
      times,
      runResults: [],
      names,
    });
    return rowChanges(opened);
  }

  it("shows the scanned athlete and the athlete the row was changed to", () => {
    expect(changesOf(saved(34, "02:31.10", "p1", "t1"))).toEqual([
      "Scanned #12 → #34",
    ]);
  });

  it("shows a Skip given its athlete", () => {
    expect(changesOf(saved(34, null, "p2", null))).toEqual([
      "Scanned a Skip → #34",
    ]);
  });

  it("shows the captured time and the time the row was changed to", () => {
    expect(changesOf(saved(12, "02:30.90", "p1", "t1"))).toEqual([
      "Captured 02:31.10 → 02:30.90",
    ]);
  });

  it("shows a Missed finish given its time", () => {
    expect(changesOf(saved(12, "02:40.00", "p1", "t2"))).toEqual([
      "Missed finish → 02:40.00",
    ]);
  });

  it("shows nothing for a row that matches its Captures", () => {
    expect(changesOf(saved(12, "02:31.10", "p1", "t1"))).toEqual([]);
  });

  it("labels a row the official added", () => {
    expect(changesOf(saved(56, "02:40.00", null, null))).toEqual([
      "Added by official",
    ]);
  });

  it("labels a Run result saved before Reconciliations were stored that no Capture accounts for", () => {
    const [, , leftOver] = openReconciliation({
      saved: [],
      positions,
      times,
      runResults: [{ athleteNo: 56, runTime: "02:40.00", status: "ok" }],
      names,
    });
    expect(rowChanges(leftOver)).toEqual(["Saved, no capture"]);
  });
});

describe("runTimeInput", () => {
  it("reads a cleared time field as no time", () => {
    expect(runTimeInput("")).toBeNull();
    expect(runTimeInput("   ")).toBeNull();
  });

  it("keeps a typed time as typed", () => {
    expect(runTimeInput("02:30.90")).toBe("02:30.90");
  });
});

describe("reconciliationPayload", () => {
  it("saves every row in order with the Captures it came from, and a time only for an ok status", () => {
    const positions = [position("p1", 1, 12), position("p2", 2, null)];
    const times = [time("t1", 1, "02:31.10"), time("t2", 2, "02:35.00")];
    const rows = openReconciliation({
      saved: [],
      positions,
      times,
      runResults: [],
      names,
    });
    rows[0] = { ...rows[0], status: "dnf" };

    expect(reconciliationPayload(rows)).toEqual([
      {
        athlete_no: 12,
        run_time: null,
        status: "dnf",
        position_capture_id: "p1",
        time_capture_id: "t1",
      },
      {
        athlete_no: null,
        run_time: "02:35.00",
        status: "ok",
        position_capture_id: "p2",
        time_capture_id: "t2",
      },
    ]);
  });
});
