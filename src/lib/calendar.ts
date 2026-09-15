import { todayISO } from "./dates";

export interface DayCell {
  date: string;
  inMonth: boolean;
}

/**
 * Six-by-seven grid for a month, weeks starting Monday. Always 42 cells so
 * the calendar doesn't jump in height between months.
 */
export function monthGrid(month: string): DayCell[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(y, m - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const date = todayISO(d);
    return { date, inMonth: date.startsWith(month) };
  });
}

export const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Groups anything dated by its YYYY-MM-DD key. */
export function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  }
  return map;
}
