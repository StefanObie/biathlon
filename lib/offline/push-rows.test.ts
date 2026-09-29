import { describe, expect, it } from "vitest";

import { pushRows } from "./push-rows";

const refused = { error: { code: "42501" } };
const ok = { error: null };

function fakeServer(refusedIds: string[], offline = false) {
  const calls: string[][] = [];
  const upsert = async (rows: { id: string }[]) => {
    calls.push(rows.map((r) => r.id));
    if (offline) return { error: { code: "" } };
    return rows.some((r) => refusedIds.includes(r.id)) ? refused : ok;
  };
  return { calls, upsert };
}

describe("pushRows", () => {
  it("sends the rows as one batch when the server takes them", async () => {
    const server = fakeServer([]);
    const landed = await pushRows([{ id: "a" }, { id: "b" }], server.upsert);
    expect(landed).toEqual(new Set(["a", "b"]));
    expect(server.calls).toEqual([["a", "b"]]);
  });

  it("sends the rows one at a time when the batch is refused, so the rest still land", async () => {
    const server = fakeServer(["b"]);
    const landed = await pushRows(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      server.upsert,
    );
    expect(landed).toEqual(new Set(["a", "c"]));
    expect(server.calls).toEqual([["a", "b", "c"], ["a"], ["b"], ["c"]]);
  });

  it("lands nothing, without retrying row by row, when the batch fails for another reason", async () => {
    const server = fakeServer([], true);
    const landed = await pushRows([{ id: "a" }, { id: "b" }], server.upsert);
    expect(landed).toEqual(new Set());
    expect(server.calls).toEqual([["a", "b"]]);
  });
});
