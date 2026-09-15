import { addDays, formatFullDate, monthOf, shiftMonth } from "./dates";
import { levelAt } from "./ladders";
import { formatMoney } from "./money";
import { spanAt, versionSpans } from "./versions";
import type { LifeDoc } from "./types";

export interface CompareRow {
  label: string;
  then: string | null;
  now: string | null;
  /** true = went up, false = went down, null = same or not comparable. */
  up: boolean | null;
}

export interface ThenAndNow {
  label: string;
  baseline: string;
  rows: CompareRow[];
}

/** Average of logged months in the three months ending at `month`. */
function avg3(doc: LifeDoc, month: string): number | null {
  const from = shiftMonth(month, -2);
  const xs = doc.income.filter((i) => i.month >= from && i.month <= month);
  return xs.length ? xs.reduce((s, i) => s + i.amount, 0) / xs.length : null;
}

/**
 * The page's reason to exist: who you were a year ago next to who you are now.
 * With less than a year of history, compares against the first thing logged.
 */
export function thenAndNow(doc: LifeDoc, today: string): ThenAndNow | null {
  const dates = [
    ...doc.moments.map((m) => m.date),
    ...doc.income.map((i) => `${i.month}-01`),
    ...doc.versions.map((v) => v.startDate),
  ].filter((d) => d <= today);
  if (!dates.length) return null;
  const earliest = dates.reduce((a, b) => (a < b ? a : b));
  if (earliest > addDays(today, -30)) return null;

  const yearAgo = addDays(today, -365);
  const baseline = earliest > yearAgo ? earliest : yearAgo;
  const rows: CompareRow[] = [];

  const spans = versionSpans(doc.versions);
  const vThen = spanAt(spans, baseline)?.version.name ?? null;
  const vNow = spanAt(spans, today)?.version.name ?? null;
  if (vThen || vNow) rows.push({ label: "Version", then: vThen, now: vNow, up: vThen !== vNow && !!vNow ? true : null });

  for (const ladder of doc.ladders) {
    const then = levelAt(ladder, doc.moments, baseline);
    const now = levelAt(ladder, doc.moments, today);
    if (!then && !now) continue;
    const a = then ? ladder.levels.indexOf(then) : -1;
    const b = now ? ladder.levels.indexOf(now) : -1;
    rows.push({ label: ladder.name, then, now, up: b > a ? true : b < a ? false : null });
  }

  const moneyThen = avg3(doc, monthOf(baseline));
  const moneyNow = avg3(doc, monthOf(today));
  if (moneyThen !== null || moneyNow !== null) {
    rows.push({
      label: "Monthly income",
      then: moneyThen !== null ? formatMoney(moneyThen, doc.currency) : null,
      now: moneyNow !== null ? formatMoney(moneyNow, doc.currency) : null,
      up: moneyThen !== null && moneyNow !== null && moneyNow !== moneyThen ? moneyNow > moneyThen : null,
    });
  }

  const tpThen = doc.moments.filter((m) => m.big && m.date <= baseline).length;
  const tpNow = doc.moments.filter((m) => m.big && m.date <= today).length;
  if (tpNow) rows.push({ label: "Turning points lived", then: String(tpThen), now: String(tpNow), up: tpNow > tpThen ? true : null });

  return {
    label: baseline === yearAgo ? "A year ago" : `Since ${formatFullDate(baseline)}`,
    baseline,
    rows,
  };
}
