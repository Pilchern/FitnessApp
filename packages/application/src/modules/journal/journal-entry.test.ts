import { afterEach, describe, expect, it } from "vitest";
import { computeJournalStreak, inferJournalTags } from "../../index";

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

/**
 * Node re-reads `process.env.TZ` for subsequent Date operations, so this really
 * does exercise the date math under a different host timezone.
 */
function withTimezone<T>(timezone: string, fn: () => T): T {
  process.env.TZ = timezone;
  try {
    return fn();
  } finally {
    if (ORIGINAL_TZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = ORIGINAL_TZ;
    }
  }
}

function entriesFor(...dates: string[]) {
  return dates.map((entryDate) => ({ entryDate }));
}

describe("inferJournalTags", () => {
  it("infers a tag for each matching rule in the body", () => {
    expect(
      inferJournalTags("Heavy lifting session then an easy run", []).sort(),
    ).toEqual(["running", "strength"]);
  });

  it("matches case-insensitively", () => {
    expect(inferJournalTags("SLEPT badly, felt STRESSED", []).sort()).toEqual([
      "sleep",
      "stress",
    ]);
  });

  it("matches multi-word and abbreviated patterns", () => {
    expect(
      inferJournalTags("Easy zone 2 spin, then VO2 work", []).sort(),
    ).toEqual(["vo2", "zone2"]);
    expect(
      inferJournalTags("New personal record on the deadlift", []),
    ).toContain("pr");
    expect(inferJournalTags("z2 only today", [])).toEqual(["zone2"]);
  });

  it("respects word boundaries and does not match substrings", () => {
    // "printer" contains "pr", "sprinted" contains "ran"/"run"-adjacent text,
    // "brandy" contains "ran", "prepared" contains "pr" — none should tag.
    expect(
      inferJournalTags(
        "Fixed the printer, sprinted upstairs, prepared brandy",
        [],
      ),
    ).toEqual([]);
  });

  it("returns an empty list when the body has no recognisable signal", () => {
    expect(inferJournalTags("Quiet day, nothing much to report.", [])).toEqual(
      [],
    );
    expect(inferJournalTags("", [])).toEqual([]);
  });

  it("preserves existing tags and never duplicates an inferred one", () => {
    expect(
      inferJournalTags("Long ride today, felt tired after", [
        "cycling",
        "manual-tag",
      ]),
    ).toEqual(["cycling", "manual-tag", "fatigue"]);
  });

  it("keeps existing tags even when the body matches nothing", () => {
    expect(inferJournalTags("nothing notable", ["manual-tag"])).toEqual([
      "manual-tag",
    ]);
  });

  it("groups synonyms onto a single tag rather than one tag per word", () => {
    expect(
      inferJournalTags("Wine and beer at dinner, plus a few drinks after", []),
    ).toEqual(["alcohol"]);
  });

  it("documents the known 'cold' false positive on the illness rule", () => {
    // The illness rule is /\b(sick|illness|cold|flu)\b/, so a cold plunge or
    // cold weather is tagged as illness. Documented, not endorsed.
    expect(inferJournalTags("Cold plunge after the session", [])).toContain(
      "illness",
    );
  });
});

describe("computeJournalStreak", () => {
  it("returns 0 when there are no entries at all", () => {
    expect(computeJournalStreak([], "2026-08-26")).toBe(0);
  });

  it("returns 0 when today has no entry, even with a long prior run", () => {
    expect(
      computeJournalStreak(
        entriesFor("2026-08-25", "2026-08-24", "2026-08-23"),
        "2026-08-26",
      ),
    ).toBe(0);
  });

  it("counts a single day", () => {
    expect(computeJournalStreak(entriesFor("2026-08-26"), "2026-08-26")).toBe(
      1,
    );
  });

  it("counts consecutive days back from today and stops at the first gap", () => {
    expect(
      computeJournalStreak(
        // 08-23 is missing, so the streak stops after 08-24.
        entriesFor("2026-08-26", "2026-08-25", "2026-08-24", "2026-08-22"),
        "2026-08-26",
      ),
    ).toBe(3);
  });

  it("does not inflate the streak when a date is logged more than once", () => {
    expect(
      computeJournalStreak(
        entriesFor("2026-08-26", "2026-08-26", "2026-08-25", "2026-08-25"),
        "2026-08-26",
      ),
    ).toBe(2);
  });

  it("walks correctly across a month boundary", () => {
    expect(
      computeJournalStreak(
        entriesFor("2026-09-01", "2026-08-31", "2026-08-30"),
        "2026-09-01",
      ),
    ).toBe(3);
  });

  it("walks correctly across a year boundary", () => {
    expect(
      computeJournalStreak(
        entriesFor("2026-01-01", "2025-12-31", "2025-12-30"),
        "2026-01-01",
      ),
    ).toBe(3);
  });

  it("walks correctly across a leap day", () => {
    expect(
      computeJournalStreak(
        entriesFor("2028-03-01", "2028-02-29", "2028-02-28"),
        "2028-03-01",
      ),
    ).toBe(3);
  });

  // Regression: the cursor used to be built with `new Date(`${today}T12:00:00`)`
  // (parsed as LOCAL time) and read back with `.toISOString()` (UTC). At a large
  // positive offset such as UTC+14 the walk back from 2026-08-26 produced
  // 2026-08-24, 2026-08-23, 2026-08-22 — 2026-08-25 was never visited, so this
  // genuine 2-day streak reported 1. At a large negative offset the cursor
  // repeated a day instead.
  it.each([
    ["UTC", 2],
    ["Pacific/Kiritimati", 2], // UTC+14
    ["Pacific/Auckland", 2], // UTC+12/+13
    ["Asia/Kolkata", 2], // UTC+5:30
    ["America/Los_Angeles", 2], // UTC-7/-8
    ["Pacific/Midway", 2], // UTC-11
  ])("is timezone-independent in %s", (timezone, expected) => {
    expect(
      withTimezone(timezone, () =>
        computeJournalStreak(
          entriesFor("2026-08-26", "2026-08-25"),
          "2026-08-26",
        ),
      ),
    ).toBe(expected);
  });

  it("counts a long run identically at UTC+14 and UTC-11", () => {
    const entries = entriesFor(
      "2026-08-26",
      "2026-08-25",
      "2026-08-24",
      "2026-08-23",
      "2026-08-22",
    );
    const east = withTimezone("Pacific/Kiritimati", () =>
      computeJournalStreak(entries, "2026-08-26"),
    );
    const west = withTimezone("Pacific/Midway", () =>
      computeJournalStreak(entries, "2026-08-26"),
    );
    expect(east).toBe(5);
    expect(west).toBe(5);
  });
});
