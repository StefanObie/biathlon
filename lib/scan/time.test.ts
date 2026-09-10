import { describe, expect, it } from "vitest";

import { formatElapsed, nextSeq } from "./time";

describe("formatElapsed", () => {
  it("formats sub-minute elapsed time", () => {
    expect(formatElapsed(1703)).toBe("00:01.70");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(107_030)).toBe("01:47.03");
  });

  it("pads single-digit components", () => {
    expect(formatElapsed(65_010)).toBe("01:05.01");
  });

  it("rounds to the nearest centisecond", () => {
    expect(formatElapsed(1706)).toBe("00:01.71");
  });
});

describe("nextSeq", () => {
  it("starts a fresh heat at 1", () => {
    expect(nextSeq([])).toBe(1);
  });

  it("resumes one past the highest captured seq", () => {
    expect(nextSeq([1, 2, 3])).toBe(4);
  });

  it("still counts voided seqs towards the max", () => {
    expect(nextSeq([1, 2, 3, 3])).toBe(4);
  });
});
