import { describe, expect, it } from "vitest";

import {
  callRoomHints,
  type HintAthlete,
  type HintRow,
} from "./call-room-hints";

const athletes: HintAthlete[] = [
  { athleteNo: 1, runHeat: 1 },
  { athleteNo: 2, runHeat: 1 },
  { athleteNo: 3, runHeat: 1 },
  { athleteNo: 4, runHeat: 2 },
];
const finished = (athleteNo: number): HintRow => ({ athleteNo, status: "ok" });

describe("callRoomHints", () => {
  it("suggests DNS for a Not checked in athlete who didn't finish", () => {
    const hints = callRoomHints(
      1,
      athletes,
      [{ athleteNo: 1, runHeat: 1 }],
      [finished(1)],
    );
    expect(hints.map((h) => [h.athleteNo, h.kind])).toEqual([
      [2, "suggest-dns"],
      [3, "suggest-dns"],
    ]);
  });

  it("gives no hint to a finisher who was Not checked in", () => {
    const hints = callRoomHints(
      1,
      athletes,
      [{ athleteNo: 1, runHeat: 1 }],
      [finished(1), finished(2), finished(3)],
    );
    expect(hints).toEqual([]);
  });

  it("flags a Checked in athlete with no finish", () => {
    const hints = callRoomHints(
      1,
      athletes,
      [
        { athleteNo: 1, runHeat: 1 },
        { athleteNo: 2, runHeat: 1 },
        { athleteNo: 3, runHeat: 1 },
      ],
      [finished(1), { athleteNo: 2, status: "dnf" }],
    );
    expect(hints.map((h) => [h.athleteNo, h.kind])).toEqual([
      [2, "checked-in-no-finish"],
      [3, "checked-in-no-finish"],
    ]);
  });

  it("notes an athlete checked in at a different heat than rostered", () => {
    const hints = callRoomHints(
      1,
      athletes,
      [
        { athleteNo: 1, runHeat: 1 },
        { athleteNo: 4, runHeat: 1 },
        { athleteNo: 3, runHeat: 2 },
      ],
      [finished(1), finished(2), finished(4), finished(3)],
    );
    expect(hints).toEqual([
      {
        athleteNo: 3,
        kind: "heat-mismatch",
        message: "Checked in at heat 2, rostered in heat 1",
      },
      {
        athleteNo: 4,
        kind: "heat-mismatch",
        message: "Checked in at heat 1, rostered in heat 2",
      },
    ]);
  });

  it("gives no hints for a heat with no check-ins", () => {
    expect(
      callRoomHints(1, athletes, [{ athleteNo: 4, runHeat: 2 }], []),
    ).toEqual([]);
    expect(callRoomHints(1, athletes, [], [])).toEqual([]);
  });

  it("doesn't suggest DNS for an athlete already marked DNS", () => {
    const hints = callRoomHints(
      1,
      athletes,
      [{ athleteNo: 1, runHeat: 1 }],
      [finished(1), { athleteNo: 2, status: "dns" }, finished(3)],
    );
    expect(hints).toEqual([]);
  });
});
