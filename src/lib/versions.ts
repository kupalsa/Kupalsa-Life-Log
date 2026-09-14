import { addDays } from "./dates";
import type { IncomeMonth, Moment, Version } from "./types";

export interface VersionSpan {
  version: Version;
  start: string;
  /** Last day of the version, or null while it is the current one. */
  end: string | null;
}

/** Versions in time order, each ending the day before the next begins. */
export function versionSpans(versions: Version[]): VersionSpan[] {
  const sorted = [...versions].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return sorted.map((version, i) => ({
    version,
    start: version.startDate,
    end: i + 1 < sorted.length ? addDays(sorted[i + 1].startDate, -1) : null,
  }));
}

/** The version a date falls in; null before the first version began. */
export function spanAt(spans: VersionSpan[], date: string): VersionSpan | null {
  let hit: VersionSpan | null = null;
  for (const s of spans) {
    if (s.start <= date) hit = s;
    else break;
  }
  return hit;
}

/**
 * A month belongs to the version active on its 15th — a version that starts
 * on the 20th doesn't claim a month that was mostly lived as the previous one.
 */
export function spanForMonth(spans: VersionSpan[], month: string): VersionSpan | null {
  return spanAt(spans, `${month}-15`);
}

export function momentsInSpan(span: VersionSpan, moments: Moment[]): Moment[] {
  return moments.filter((m) => m.date >= span.start && (span.end === null || m.date <= span.end));
}

export function incomeInSpan(spans: VersionSpan[], span: VersionSpan, income: IncomeMonth[]) {
  const months = income.filter((i) => spanForMonth(spans, i.month)?.version.id === span.version.id);
  const total = months.reduce((sum, i) => sum + i.amount, 0);
  return { months, total, avg: months.length ? total / months.length : null };
}

/** "v7" → "v8"; anything else gets no guess. */
export function suggestNextName(versions: Version[]): string {
  const last = [...versions].sort((a, b) => a.startDate.localeCompare(b.startDate)).at(-1);
  const match = last?.name.match(/^v(\d+)$/i);
  if (match) return `v${Number(match[1]) + 1}`;
  return versions.length ? "" : "v1";
}
