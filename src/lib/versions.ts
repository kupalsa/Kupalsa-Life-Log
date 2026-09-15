import { addDays } from "./dates";
import { noteLines, type IncomeMonth, type Moment, type Version } from "./types";

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

/**
 * Semver-style bumps: "2.0" → "3.0", "2.1" → "3.0", "v7" → "v8".
 * Minor releases are the user's choice; the suggestion is always a major one.
 */
export function suggestNextName(versions: Version[]): string {
  const last = [...versions].sort((a, b) => a.startDate.localeCompare(b.startDate)).at(-1);
  if (!last) return "1.0";
  const semver = last.name.match(/^(\D*)(\d+)(?:\.\d+)*$/);
  if (semver && last.name.includes(".")) return `${semver[1]}${Number(semver[2]) + 1}.0`;
  const plain = last.name.match(/^(\D*)(\d+)$/);
  if (plain) return `${plain[1]}${Number(plain[2]) + 1}`;
  return "";
}

/**
 * Starting a new version: what was a known issue in the previous one is the
 * checklist for this one. Issues marked fixed move to "Fixed"; the rest carry
 * over as still-known.
 */
export function carryOverNotes(previous: Version | undefined, fixed: Set<string>) {
  const known = previous ? noteLines(previous.notes.known) : [];
  return {
    fixed: known.filter((k) => fixed.has(k)).join("\n"),
    known: known.filter((k) => !fixed.has(k)).join("\n"),
  };
}
