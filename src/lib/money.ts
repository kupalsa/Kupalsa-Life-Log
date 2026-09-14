import { shiftMonth } from "./dates";
import type { IncomeMonth } from "./types";

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "₪12,400", "−₪1,200" */
export function formatMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}${currency}${whole.format(Math.abs(Math.round(amount)))}`;
}

/** Axis ticks: "₪12k", "₪1.5k", "₪800" */
export function compactMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${currency}${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${currency}${trim(abs / 1_000)}k`;
  return `${sign}${currency}${whole.format(abs)}`;
}

function trim(n: number): string {
  return n >= 10 ? whole.format(Math.round(n)) : String(Math.round(n * 10) / 10);
}

/** Parses what people type: "12,400", "12400", "12.5k", "-800". Null when not a number. */
export function parseAmount(input: string): number | null {
  const clean = input.replace(/[,\s₪$€£]/g, "").replace(/[−–]/g, "-").toLowerCase();
  if (!clean) return null;
  const k = clean.endsWith("k");
  const n = Number(k ? clean.slice(0, -1) : clean);
  if (!Number.isFinite(n)) return null;
  return k ? n * 1000 : n;
}

export interface IncomeSummary {
  thisYear: number;
  /** Same months of last year, for a fair comparison. Null when none were logged. */
  lastYearSamePeriod: number | null;
  /** Average over logged months in the last 12 — a missing month is unknown, not zero. */
  avg12: number | null;
  logged12: number;
  best: IncomeMonth | null;
  allTime: number;
}

export function summarizeIncome(income: IncomeMonth[], currentMonth: string): IncomeSummary {
  const year = currentMonth.slice(0, 4);
  const lastYear = String(Number(year) - 1);
  const monthNum = currentMonth.slice(5);

  const thisYear = income
    .filter((i) => i.month.startsWith(year) && i.month <= currentMonth)
    .reduce((s, i) => s + i.amount, 0);

  const lastYearMonths = income.filter(
    (i) => i.month.startsWith(lastYear) && i.month.slice(5) <= monthNum,
  );
  const lastYearSamePeriod = lastYearMonths.length
    ? lastYearMonths.reduce((s, i) => s + i.amount, 0)
    : null;

  const from = shiftMonth(currentMonth, -11);
  const recent = income.filter((i) => i.month >= from && i.month <= currentMonth);
  const avg12 = recent.length ? recent.reduce((s, i) => s + i.amount, 0) / recent.length : null;

  const best = income.reduce<IncomeMonth | null>((b, i) => (!b || i.amount > b.amount ? i : b), null);

  return {
    thisYear,
    lastYearSamePeriod,
    avg12,
    logged12: recent.length,
    best,
    allTime: income.reduce((s, i) => s + i.amount, 0),
  };
}

/** "Nice" axis ticks spanning [min, max], always including 0. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi === lo) return [0];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= hi + step * 0.001; t += step) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
