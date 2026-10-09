import { describe, expect, it } from "vitest";

import {
  driveFolderId,
  findLeagueFolder,
  leagueFolderName,
  pickResultsFile,
} from "@/lib/swim/drive-folder";

describe("leagueFolderName", () => {
  it("is the League's name and date, as the Swim folder names them", () => {
    expect(leagueFolderName("League 3", "2026-10-06")).toBe(
      "League 3 - 6 Oct 2026",
    );
  });

  it("writes September as Sep, whatever the runtime's locale data says", () => {
    expect(leagueFolderName("League 1", "2026-09-14")).toBe(
      "League 1 - 14 Sep 2026",
    );
  });
});

describe("findLeagueFolder", () => {
  const folders = [
    { id: "a", name: "League 2 - 22 Sep 2026" },
    { id: "b", name: "League 3 - 6 Oct 2026" },
  ];

  it("finds the folder named after the League", () => {
    expect(findLeagueFolder(folders, "League 3", "2026-10-06")?.id).toBe("b");
  });

  it("ignores case and stray spaces", () => {
    expect(
      findLeagueFolder(
        [{ id: "c", name: " league 3  -  6 oct 2026 " }],
        "League 3 ",
        "2026-10-06",
      )?.id,
    ).toBe("c");
  });

  it("finds nothing when no folder has the name", () => {
    expect(findLeagueFolder(folders, "League 4", "2026-10-20")).toBeNull();
  });

  it("finds nothing when two folders have the name, rather than guess", () => {
    expect(
      findLeagueFolder(
        [...folders, { id: "d", name: "League 3 - 6 Oct 2026" }],
        "League 3",
        "2026-10-06",
      ),
    ).toBeNull();
  });
});

describe("pickResultsFile", () => {
  const file = (name: string, modifiedTime: string) => ({
    id: name,
    name,
    modifiedTime,
  });

  it("takes the only .txt", () => {
    expect(
      pickResultsFile([
        file("heat-1-times.csv", "2026-10-06T18:00:00Z"),
        file(
          "2026-10-06-League-3-Session-1-results.txt",
          "2026-10-06T17:00:00Z",
        ),
      ])?.name,
    ).toBe("2026-10-06-League-3-Session-1-results.txt");
  });

  it("takes the most recently modified .txt when there are several", () => {
    expect(
      pickResultsFile([
        file("old.txt", "2026-10-06T17:00:00Z"),
        file("new.TXT", "2026-10-06T19:00:00Z"),
        file("middle.txt", "2026-10-06T18:00:00Z"),
      ])?.name,
    ).toBe("new.TXT");
  });

  it("finds nothing when there is no .txt", () => {
    expect(
      pickResultsFile([file("heat-1.csv", "2026-10-06T17:00:00Z")]),
    ).toBeNull();
  });
});

describe("driveFolderId", () => {
  it("reads the id from a folder link", () => {
    expect(
      driveFolderId(
        "https://drive.google.com/drive/folders/1AbC-d_EfG?usp=sharing",
      ),
    ).toBe("1AbC-d_EfG");
  });

  it("reads the id from a link into a shared drive", () => {
    expect(
      driveFolderId("https://drive.google.com/drive/u/1/folders/1AbC-d_EfG"),
    ).toBe("1AbC-d_EfG");
  });

  it("takes a bare id as it is", () => {
    expect(driveFolderId("  1AbC-d_EfG  ")).toBe("1AbC-d_EfG");
  });

  it("rejects anything else", () => {
    expect(driveFolderId("https://example.com/folders/x y")).toBeNull();
    expect(driveFolderId("")).toBeNull();
  });
});
