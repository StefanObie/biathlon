import { describe, expect, it } from "vitest";

import { autoSavePlan, carryOverReview } from "./auto-save";
import type { ResolvedSwimRow } from "./resolve";

function resolved(overrides: Partial<ResolvedSwimRow> = {}): ResolvedSwimRow {
  const athleteNo = overrides.athleteNo ?? 1234;
  return {
    localId: `swim-3-1-0`,
    raw: {
      eventNo: 2,
      heat: 3,
      race: 3,
      distanceM: 50,
      lane: 1,
      place: 1,
      name: "Test Swimmer",
      athleteNo,
      truncated: false,
      time: "00:35.00",
      backupTimes: [],
      backupsDisagree: false,
      revised: false,
      noShow: false,
      sourceLine: `   1      1  Test Swimmer (${athleteNo})   35.00`,
      lineNo: 1,
    },
    athleteNo,
    athleteName: "Test Swimmer",
    state: "matched",
    reasons: [],
    suggestion: null,
    time: "00:35.00",
    status: "ok",
    edited: false,
    ...overrides,
  };
}

describe("autoSavePlan", () => {
  it("auto-saves a matched row with no saved result", () => {
    const row = resolved();
    const plan = autoSavePlan([row], []);
    expect(plan.autoSave).toEqual([row]);
    expect(plan.held).toEqual([]);
  });

  it("leaves a row alone when its saved time is the same", () => {
    const plan = autoSavePlan(
      [resolved()],
      [
        {
          athlete_no: 1234,
          swim_time: "00:35.00",
          status: "ok",
          source: "import",
        },
      ],
    );
    expect(plan.autoSave).toEqual([]);
    expect(plan.held).toEqual([]);
  });

  it("auto-saves a row whose time changed since it was saved", () => {
    const row = resolved({ time: "00:34.10" });
    const plan = autoSavePlan(
      [row],
      [
        {
          athlete_no: 1234,
          swim_time: "00:35.00",
          status: "ok",
          source: "import",
        },
      ],
    );
    expect(plan.autoSave).toEqual([row]);
  });

  it("auto-saves a row matched by lane", () => {
    const row = resolved({ state: "matched-by-lane" });
    expect(autoSavePlan([row], []).autoSave).toEqual([row]);
  });

  it("holds a row that needs review", () => {
    const row = resolved({ state: "needs-review" });
    const plan = autoSavePlan([row], []);
    expect(plan.autoSave).toEqual([]);
    expect(plan.held).toEqual([row]);
  });

  it("holds an unresolved row", () => {
    const row = resolved({
      state: "unresolved",
      athleteNo: null,
      athleteName: null,
    });
    const plan = autoSavePlan([row], []);
    expect(plan.autoSave).toEqual([]);
    expect(plan.held).toEqual([row]);
  });

  it("holds a row that would overwrite a manual result", () => {
    const row = resolved({ time: "00:34.10" });
    const plan = autoSavePlan(
      [row],
      [
        {
          athlete_no: 1234,
          swim_time: "00:35.00",
          status: "ok",
          source: "manual",
        },
      ],
    );
    expect(plan.autoSave).toEqual([]);
    expect(plan.held).toEqual([row]);
  });

  it("neither saves nor holds an empty lane", () => {
    const row = resolved({
      state: "no-result",
      athleteNo: null,
      athleteName: null,
      time: null,
      status: "dns",
    });
    expect(autoSavePlan([row], [])).toEqual({ autoSave: [], held: [] });
  });

  it("holds both rows of an athlete who appears twice", () => {
    const first = resolved({ localId: "swim-3-1-0" });
    const second = resolved({ localId: "swim-4-2-1", time: "00:36.00" });
    const plan = autoSavePlan([first, second], []);
    expect(plan.autoSave).toEqual([]);
    expect(plan.held).toEqual([first, second]);
  });
});

describe("autoSavePlan with the Official's review", () => {
  it("holds a row the Official edited", () => {
    const row = resolved({ time: "00:33.00", edited: true });
    const plan = autoSavePlan([row], []);
    expect(plan.autoSave).toEqual([]);
    expect(plan.held).toEqual([row]);
  });
});

describe("carryOverReview", () => {
  it("keeps the Official's edit to a row over the rebuilt one", () => {
    const edited = resolved({ time: "00:33.00", edited: true });
    const rebuilt = resolved({ localId: "swim-3-1-4", time: "00:35.00" });
    const review = carryOverReview({ rows: [edited], removed: new Set() }, [
      rebuilt,
    ]);
    expect(review.rows).toEqual([{ ...edited, localId: "swim-3-1-4" }]);
  });

  it("takes unedited rows from the newer file", () => {
    const old = resolved({ time: "00:35.00" });
    const rebuilt = resolved({ localId: "swim-3-1-4", time: "00:34.00" });
    const review = carryOverReview({ rows: [old], removed: new Set() }, [
      rebuilt,
    ]);
    expect(review.rows).toEqual([rebuilt]);
  });

  it("keeps a removed row removed", () => {
    const old = resolved();
    const rebuilt = resolved({ localId: "swim-3-1-4" });
    const review = carryOverReview(
      { rows: [old], removed: new Set([old.localId]) },
      [rebuilt],
    );
    expect([...review.removed]).toEqual(["swim-3-1-4"]);
  });
});
