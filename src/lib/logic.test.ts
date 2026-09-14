import { describe, expect, it } from "vitest";
import { addDays, monthRange, shiftMonth, spanLabel } from "./dates";
import { formatMoney, niceTicks, parseAmount, summarizeIncome } from "./money";
import { incomeInSpan, spanAt, spanForMonth, suggestNextName, versionSpans } from "./versions";
import { emptyDoc, mergeDocs, normalizeDoc, type Version } from "./types";

const v = (name: string, startDate: string): Version => ({ id: name, name, startDate, headline: "", note: "" });

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
  const spans = versionSpans([v("v7", "2026-09-14"), v("v5", "2024-01-01"), v("v6", "2025-06-20")]);

  it("orders versions and ends each the day before the next", () => {
    expect(spans.map((s) => [s.version.name, s.start, s.end])).toEqual([
      ["v5", "2024-01-01", "2025-06-19"],
      ["v6", "2025-06-20", "2026-09-13"],
      ["v7", "2026-09-14", null],
    ]);
  });

  it("finds the version for a date", () => {
    expect(spanAt(spans, "2023-12-31")).toBeNull();
    expect(spanAt(spans, "2025-06-19")?.version.name).toBe("v5");
    expect(spanAt(spans, "2025-06-20")?.version.name).toBe("v6");
  });

  it("gives a month to the version active on the 15th", () => {
    // v6 starts on the 20th, so June 2025 was mostly still v5.
    expect(spanForMonth(spans, "2025-06")?.version.name).toBe("v5");
    // v7 starts on the 14th, so it claims September.
    expect(spanForMonth(spans, "2026-09")?.version.name).toBe("v7");
  });

  it("totals and averages income per version over logged months only", () => {
    const income = [
      { month: "2026-07", amount: 10000, note: "" },
      { month: "2026-08", amount: 20000, note: "" },
      { month: "2026-10", amount: 30000, note: "" },
    ];
    const v6 = incomeInSpan(spans, spans[1], income);
    expect(v6.total).toBe(30000);
    expect(v6.avg).toBe(15000);
    expect(incomeInSpan(spans, spans[0], income).avg).toBeNull();
  });

  it("suggests the next name", () => {
    expect(suggestNextName([v("v5", "2024-01-01"), v("v6", "2025-01-01")])).toBe("v7");
    expect(suggestNextName([])).toBe("v1");
    expect(suggestNextName([v("College", "2020-01-01")])).toBe("");
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
  it("repairs stored data instead of crashing", () => {
    const doc = normalizeDoc({
      moments: [{ date: "2026-01-02", title: "ok" }, { date: "not a date", title: "dropped" }],
      income: [
        { month: "2026-01", amount: "100" },
        { month: "2026-01", amount: 999 },
      ],
      areas: [],
    });
    expect(doc.moments).toHaveLength(1);
    expect(doc.moments[0].area).toBe("Other");
    expect(doc.income).toEqual([{ month: "2026-01", amount: 100, note: "" }]);
    expect(doc.areas.length).toBeGreaterThan(0);
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
  });
});
