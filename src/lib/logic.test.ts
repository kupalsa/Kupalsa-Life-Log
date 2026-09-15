import { describe, expect, it } from "vitest";
import { addDays, monthRange, shiftMonth, spanLabel } from "./dates";
import { formatMoney, niceTicks, parseAmount, summarizeIncome } from "./money";
import {
  carryOverNotes,
  incomeInSpan,
  spanAt,
  spanForMonth,
  suggestNextName,
  versionSpans,
} from "./versions";
import { ladderProgress, levelAt, stepLabel } from "./ladders";
import { monthGrid } from "./calendar";
import {
  BOULDERING_LEVELS,
  emptyDoc,
  emptyNotes,
  mergeDocs,
  noteLines,
  normalizeDoc,
  type Ladder,
  type Moment,
  type Version,
} from "./types";

const v = (name: string, startDate: string, known = ""): Version => ({
  id: name,
  name,
  startDate,
  headline: "",
  note: "",
  notes: { ...emptyNotes(), known },
});

const moment = (id: string, date: string, extra: Partial<Moment> = {}): Moment => ({
  id,
  date,
  title: id,
  note: "",
  area: "Climbing",
  big: false,
  photos: [],
  ladder: null,
  createdAt: `${date}T12:00:00.000Z`,
  ...extra,
});

describe("dates", () => {
  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
  });

  it("lists an inclusive month range", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthRange("2026-03", "2026-02")).toEqual([]);
  });

  it("adds days across months", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("labels spans humanely", () => {
    expect(spanLabel("2026-09-14", "2026-09-14")).toBe("1 day");
    expect(spanLabel("2026-01-01", "2026-05-31")).toBe("5 mo");
    expect(spanLabel("2024-01-01", "2026-03-31")).toBe("2 yr 3 mo");
  });
});

describe("versions", () => {
  const spans = versionSpans([v("3.0", "2026-09-14"), v("1.0", "2024-01-01"), v("2.0", "2025-06-20")]);

  it("orders versions and ends each the day before the next", () => {
    expect(spans.map((s) => [s.version.name, s.start, s.end])).toEqual([
      ["1.0", "2024-01-01", "2025-06-19"],
      ["2.0", "2025-06-20", "2026-09-13"],
      ["3.0", "2026-09-14", null],
    ]);
  });

  it("finds the version for a date", () => {
    expect(spanAt(spans, "2023-12-31")).toBeNull();
    expect(spanAt(spans, "2025-06-19")?.version.name).toBe("1.0");
    expect(spanAt(spans, "2025-06-20")?.version.name).toBe("2.0");
  });

  it("gives a month to the version active on the 15th", () => {
    // 2.0 starts on the 20th, so June 2025 was mostly still 1.0.
    expect(spanForMonth(spans, "2025-06")?.version.name).toBe("1.0");
    // 3.0 starts on the 14th, so it claims September.
    expect(spanForMonth(spans, "2026-09")?.version.name).toBe("3.0");
  });

  it("averages income per version over logged months only", () => {
    const income = [
      { month: "2026-07", amount: 10000, note: "" },
      { month: "2026-08", amount: 20000, note: "" },
      { month: "2026-10", amount: 30000, note: "" },
    ];
    const second = incomeInSpan(spans, spans[1], income);
    expect(second.total).toBe(30000);
    expect(second.avg).toBe(15000);
    expect(incomeInSpan(spans, spans[0], income).avg).toBeNull();
  });

  it("suggests the next release name", () => {
    expect(suggestNextName([])).toBe("1.0");
    expect(suggestNextName([v("1.0", "2024-01-01"), v("2.3", "2025-01-01")])).toBe("3.0");
    expect(suggestNextName([v("Nik 2.0", "2025-01-01")])).toBe("Nik 3.0");
    expect(suggestNextName([v("v6", "2025-01-01")])).toBe("v7");
    expect(suggestNextName([v("College", "2020-01-01")])).toBe("");
  });

  it("turns known issues into fixed or carried-over items", () => {
    const prev = v("1.0", "2024-01-01", "- Overtrading\n• Sleep after 2am\nNo savings");
    const next = carryOverNotes(prev, new Set(["Overtrading"]));
    expect(next.fixed).toBe("Overtrading");
    expect(next.known).toBe("Sleep after 2am\nNo savings");
  });

  it("splits release-note text into items", () => {
    expect(noteLines("  - one\n\n* two \n three")).toEqual(["one", "two", "three"]);
  });
});

describe("ladders", () => {
  const ladder: Ladder = {
    id: "b",
    name: "Bouldering",
    levels: BOULDERING_LEVELS,
    area: "Climbing",
    createdAt: "",
  };
  const moments = [
    moment("v5-late", "2025-03-01", { ladder: { ladderId: "b", level: "V5" } }),
    moment("v5", "2024-11-01", { ladder: { ladderId: "b", level: "V5" } }),
    moment("v7", "2026-08-01", { ladder: { ladderId: "b", level: "V7" } }),
    moment("other", "2026-09-01", { ladder: { ladderId: "x", level: "V9" } }),
  ];

  it("takes the first send of each level and measures steps", () => {
    const p = ladderProgress(ladder, moments);
    expect(p.rungs[5].moment?.id).toBe("v5");
    expect(p.rungs[6].moment).toBeNull();
    expect(p.top?.level).toBe("V7");
    expect(p.next).toBe("V8");
    expect(p.rungs[7].daysFromPrevious).toBe(638);
  });

  it("knows the level held on a past date", () => {
    expect(levelAt(ladder, moments, "2024-10-31")).toBeNull();
    expect(levelAt(ladder, moments, "2025-09-15")).toBe("V5");
    expect(levelAt(ladder, moments, "2026-09-15")).toBe("V7");
  });

  it("labels step durations", () => {
    expect(stepLabel(12)).toBe("12 days");
    expect(stepLabel(213)).toBe("7 mo");
    expect(stepLabel(430)).toBe("1 yr 2 mo");
  });
});

describe("calendar", () => {
  it("builds a Monday-first 42-cell grid", () => {
    const grid = monthGrid("2026-09");
    expect(grid).toHaveLength(42);
    expect(grid[0].date).toBe("2026-08-31"); // Sep 1 2026 is a Tuesday
    expect(grid[1]).toEqual({ date: "2026-09-01", inMonth: true });
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30);
  });
});

describe("money", () => {
  it("formats with sign and currency", () => {
    expect(formatMoney(12400.4, "₪")).toBe("₪12,400");
    expect(formatMoney(-800, "$")).toBe("−$800");
  });

  it("parses what people type", () => {
    expect(parseAmount("12,400")).toBe(12400);
    expect(parseAmount("12.5k")).toBe(12500);
    expect(parseAmount("₪ 900")).toBe(900);
    expect(parseAmount("−300")).toBe(-300);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("treats missing months as unknown, not zero", () => {
    const s = summarizeIncome(
      [
        { month: "2025-03", amount: 5000, note: "" },
        { month: "2025-11", amount: 8000, note: "" },
        { month: "2026-02", amount: 12000, note: "" },
        { month: "2026-05", amount: 10000, note: "" },
      ],
      "2026-09",
    );
    expect(s.thisYear).toBe(22000);
    expect(s.lastYearSamePeriod).toBe(5000);
    expect(s.logged12).toBe(3);
    expect(s.avg12).toBe(10000);
    expect(s.best?.month).toBe("2026-02");
    expect(s.allTime).toBe(35000);
  });

  it("builds ticks that include zero and cover the data", () => {
    const t = niceTicks(0, 13400);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(13400);
    const n = niceTicks(-2000, 9000);
    expect(n).toContain(0);
    expect(n[0]).toBeLessThanOrEqual(-2000);
  });
});

describe("doc", () => {
  it("upgrades a schema 1 doc and repairs bad records", () => {
    const doc = normalizeDoc({
      schema: 1,
      moments: [{ date: "2026-01-02", title: "ok" }, { date: "not a date", title: "dropped" }],
      versions: [{ name: "v5", startDate: "2024-01-01" }],
      income: [
        { month: "2026-01", amount: "100" },
        { month: "2026-01", amount: 999 },
      ],
      areas: [],
    });
    expect(doc.schema).toBe(2);
    expect(doc.moments).toHaveLength(1);
    expect(doc.moments[0]).toMatchObject({ area: "Other", photos: [], ladder: null });
    expect(doc.versions[0].notes).toEqual(emptyNotes());
    expect(doc.ladders.map((l) => l.name)).toEqual(["Bouldering"]);
    expect(doc.income).toEqual([{ month: "2026-01", amount: 100, note: "" }]);
    expect(doc.areas.length).toBeGreaterThan(0);
  });

  it("keeps an intentionally empty ladder list", () => {
    expect(normalizeDoc({ ladders: [] }).ladders).toEqual([]);
  });

  it("merges without overwriting what's already stored", () => {
    const base = normalizeDoc({
      ...emptyDoc(),
      moments: [{ id: "a", date: "2026-01-01", title: "remote" }],
      income: [{ month: "2026-01", amount: 1 }],
    });
    const local = normalizeDoc({
      ...emptyDoc(),
      moments: [
        { id: "a", date: "2026-01-01", title: "local copy" },
        { id: "b", date: "2026-02-01", title: "new" },
      ],
      income: [
        { month: "2026-01", amount: 2 },
        { month: "2026-02", amount: 3 },
      ],
    });
    const merged = mergeDocs(base, local);
    expect(merged.moments.map((m) => m.title).sort()).toEqual(["new", "remote"]);
    expect(merged.income.map((i) => i.amount)).toEqual([1, 3]);
    expect(merged.ladders).toHaveLength(1);
  });
});
