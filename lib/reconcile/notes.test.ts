import { describe, expect, it } from "vitest";

import { captureScreenState } from "@/lib/capture/screen-state";
import { buildWorkingRows, type TimeEntry } from "./join";
import { placeNotes, type OperatorNoteEntry } from "./notes";

function note(
  id: string,
  ordinal: number,
  screen: OperatorNoteEntry["screen"] = "timer",
): OperatorNoteEntry {
  return {
    id,
    ordinal,
    screen,
    body: `note ${id}`,
    createdAt: `2026-09-23T10:00:0${id.length}Z`,
  };
}

describe("placeNotes", () => {
  it("places a note on the row at its ordinal", () => {
    const placed = placeNotes([note("a", 2)], 3);

    expect(placed.byOrdinal.get(2)).toEqual([note("a", 2)]);
    expect(placed.heatLevel).toEqual([]);
  });

  it("returns a note tied to 0 at heat level", () => {
    const placed = placeNotes([note("a", 0)], 3);

    expect(placed.byOrdinal.size).toBe(0);
    expect(placed.heatLevel).toEqual([note("a", 0)]);
  });

  it("returns a note past the end of the table at heat level", () => {
    const placed = placeNotes([note("a", 4)], 3);

    expect(placed.byOrdinal.size).toBe(0);
    expect(placed.heatLevel).toEqual([note("a", 4)]);
  });

  it("puts every note at heat level when the table is empty", () => {
    const placed = placeNotes([note("a", 1), note("b", 0)], 0);

    expect(placed.heatLevel).toHaveLength(2);
  });

  it("keeps several notes on one row in the order they were written", () => {
    const first: OperatorNoteEntry = {
      ...note("a", 1),
      createdAt: "2026-09-23T10:00:00Z",
    };
    const second: OperatorNoteEntry = {
      ...note("b", 1),
      createdAt: "2026-09-23T10:05:00Z",
    };

    const placed = placeNotes([second, first], 2);

    expect(placed.byOrdinal.get(1)).toEqual([first, second]);
  });

  it("orders heat-level notes by when they were written", () => {
    const first: OperatorNoteEntry = {
      ...note("a", 0),
      createdAt: "2026-09-23T10:00:00Z",
    };
    const second: OperatorNoteEntry = {
      ...note("b", 9),
      createdAt: "2026-09-23T10:05:00Z",
    };

    const placed = placeNotes([second, first], 1);

    expect(placed.heatLevel).toEqual([first, second]);
  });

  it("keeps notes from both capture screens, each tagged with its screen", () => {
    const placed = placeNotes(
      [note("a", 1, "timer"), note("b", 1, "position")],
      1,
    );

    expect(placed.byOrdinal.get(1)?.map((n) => n.screen)).toEqual([
      "timer",
      "position",
    ]);
  });
});

describe("a note written after an undo", () => {
  it("still lands on the finisher it was written about", () => {
    // Three presses, the third undone, then a fourth. seq skips 3 (the
    // counter never reuses a voided one), but reconciliation only ever sees
    // three active rows — so a note anchored on the raw seq would point one
    // row too far, off the end of the table.
    const captures = [
      { seq: 1, voided: false },
      { seq: 2, voided: false },
      { seq: 3, voided: true },
      { seq: 4, voided: false },
    ];
    const times: TimeEntry[] = captures
      .filter((c) => !c.voided)
      .map((c) => ({
        id: `t${c.seq}`,
        seq: c.seq,
        elapsedTime: "01:00.00",
        isPlaceholder: false,
      }));
    const rows = buildWorkingRows([], times, new Map());

    // What the capture screen anchors a note on: the finished count.
    const { finished } = captureScreenState({ captures, rosterSize: 20 });
    expect(finished).toBe(3);

    const placed = placeNotes(
      [
        {
          id: "n",
          ordinal: finished,
          screen: "timer",
          body: "runner 12 cut the corner",
          createdAt: "2026-09-23T10:00:00Z",
        },
      ],
      rows.length,
    );

    expect(placed.byOrdinal.get(3)).toHaveLength(1);
    expect(placed.heatLevel).toEqual([]);
  });
});
