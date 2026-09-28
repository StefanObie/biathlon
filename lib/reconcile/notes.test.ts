import { describe, expect, it } from "vitest";

import { noteAnchor } from "@/lib/capture/operator-note";
import {
  buildWorkingRows,
  type PositionEntry,
  type TimeEntry,
  type WorkingRow,
} from "./join";
import { placeNotes, type OperatorNote } from "./notes";

function note(
  id: string,
  anchor: number,
  screen: OperatorNote["screen"] = "timer",
  createdAt = "2026-09-23T10:00:00Z",
): OperatorNote {
  return { id, anchor, screen, body: `note ${id}`, createdAt };
}

function time(seq: number): TimeEntry {
  return {
    id: `t${seq}`,
    seq,
    elapsedTime: "01:00.00",
    isPlaceholder: false,
  };
}

function position(pos: number, athleteNo: number | null): PositionEntry {
  return { id: `p${pos}`, position: pos, athleteNo };
}

/** Three finishers, times seq 1–3 zipped against positions 1–3. */
function threeRows(): WorkingRow[] {
  return buildWorkingRows(
    [position(1, 101), position(2, 102), position(3, 103)],
    [time(1), time(2), time(3)],
    new Map(),
  );
}

function gapRow(localId: string): WorkingRow {
  return {
    localId,
    position: null,
    time: null,
    athleteNo: null,
    athleteName: null,
    runTime: null,
    status: "ok",
  };
}

describe("placeNotes", () => {
  it("places a Timer screen note on the row holding its seq", () => {
    const rows = threeRows();

    const placed = placeNotes([note("a", 2, "timer")], rows);

    expect(placed.byRow.get(rows[1].localId)).toEqual([note("a", 2, "timer")]);
    expect(placed.heatLevel).toEqual([]);
  });

  it("places a Position screen note on the row holding its position", () => {
    // Positions and times out of step: the time stream is one short at the
    // top, so position 2 sits on the same row as seq 3.
    const rows = buildWorkingRows(
      [position(1, 101), position(2, 102)],
      [time(3), time(4)],
      new Map(),
    );

    const placed = placeNotes([note("a", 2, "position")], rows);

    expect(placed.byRow.get(rows[1].localId)).toEqual([
      note("a", 2, "position"),
    ]);
  });

  it("keeps a note with its capture when a gap is inserted above it", () => {
    const rows = threeRows();
    const withGap = [rows[0], gapRow("gap-1"), rows[1], rows[2]];

    const placed = placeNotes([note("a", 2)], withGap);

    expect(placed.byRow.get(rows[1].localId)).toHaveLength(1);
    expect(placed.byRow.has("gap-1")).toBe(false);
  });

  it("keeps a note with its capture when a row above it is removed", () => {
    const rows = threeRows();
    const withoutFirst = [rows[1], rows[2]];

    const placed = placeNotes([note("a", 3)], withoutFirst);

    expect(placed.byRow.get(rows[2].localId)).toHaveLength(1);
  });

  it("returns a note on a removed row at heat level", () => {
    const rows = threeRows();

    const placed = placeNotes([note("a", 2)], [rows[0], rows[2]]);

    expect(placed.byRow.size).toBe(0);
    expect(placed.heatLevel).toEqual([note("a", 2)]);
  });

  it("returns a note tied to 0 at heat level", () => {
    const placed = placeNotes([note("a", 0)], threeRows());

    expect(placed.byRow.size).toBe(0);
    expect(placed.heatLevel).toEqual([note("a", 0)]);
  });

  it("returns a note whose capture no row holds at heat level", () => {
    const placed = placeNotes([note("a", 9)], threeRows());

    expect(placed.byRow.size).toBe(0);
    expect(placed.heatLevel).toEqual([note("a", 9)]);
  });

  it("puts every note at heat level when the table is empty", () => {
    const placed = placeNotes([note("a", 1), note("b", 0)], []);

    expect(placed.heatLevel).toHaveLength(2);
  });

  it("keeps several notes on one row in the order they were written", () => {
    const rows = threeRows();
    const first = note("a", 1, "timer", "2026-09-23T10:00:00Z");
    const second = note("b", 1, "timer", "2026-09-23T10:05:00Z");

    const placed = placeNotes([second, first], rows);

    expect(placed.byRow.get(rows[0].localId)).toEqual([first, second]);
  });

  it("orders heat-level notes by when they were written", () => {
    const first = note("a", 0, "timer", "2026-09-23T10:00:00Z");
    const second = note("b", 9, "timer", "2026-09-23T10:05:00Z");

    const placed = placeNotes([second, first], threeRows());

    expect(placed.heatLevel).toEqual([first, second]);
  });

  it("keeps notes from both capture screens, each tagged with its screen", () => {
    const rows = threeRows();

    const placed = placeNotes(
      [note("a", 1, "timer"), note("b", 1, "position")],
      rows,
    );

    expect(placed.byRow.get(rows[0].localId)?.map((n) => n.screen)).toEqual([
      "timer",
      "position",
    ]);
  });
});

describe("a note written after an undo", () => {
  it("lands on the row holding the latest active capture", () => {
    // Three presses, the third undone, then a fourth. seq skips 3 (the
    // counter never reuses a voided one), so the latest capture — seq 4 —
    // sits on the third row of the table.
    const captures = [
      { seq: 1, voided: false },
      { seq: 2, voided: false },
      { seq: 3, voided: true },
      { seq: 4, voided: false },
    ];
    const active = captures.filter((c) => !c.voided).map((c) => c.seq);
    const rows = buildWorkingRows([], active.map(time), new Map());

    const anchor = noteAnchor(active);
    expect(anchor).toBe(4);

    const placed = placeNotes([note("n", anchor)], rows);

    expect(placed.byRow.get(rows[2].localId)).toHaveLength(1);
    expect(placed.heatLevel).toEqual([]);
  });
});
