import { describe, expect, it } from "vitest";

import {
  describeAnchor,
  noteAnchor,
  parseCaptureScreen,
} from "./operator-note";

describe("noteAnchor", () => {
  it("is 0 before the first finisher", () => {
    expect(noteAnchor([])).toBe(0);
  });

  it("is the highest active seq or position", () => {
    expect(noteAnchor([1, 2, 4])).toBe(4);
  });
});

describe("parseCaptureScreen", () => {
  it("accepts both capture screens", () => {
    expect(parseCaptureScreen("timer")).toBe("timer");
    expect(parseCaptureScreen("position")).toBe("position");
  });

  it("throws on anything else instead of guessing a screen", () => {
    expect(() => parseCaptureScreen("reconcile")).toThrow(
      "Unknown operator note screen: reconcile",
    );
  });
});

describe("describeAnchor", () => {
  it("names the capture the note is tied to", () => {
    expect(describeAnchor("timer", 4)).toBe("time #4");
    expect(describeAnchor("position", 4)).toBe("position #4");
  });

  it("reads as the start of the heat before the first finisher", () => {
    expect(describeAnchor("timer", 0)).toBe("the start of the heat");
  });
});
