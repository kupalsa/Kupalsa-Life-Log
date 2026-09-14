const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Today as YYYY-MM-DD in local time (toISOString would give UTC's date). */
export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d || 1);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addDays(date: string, days: number): string {
  const d = parseISO(date);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Every month from `from` to `to`, inclusive. Empty when from > to. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

/** "14 Sep" */
export function formatDay(date: string): string {
  const d = parseISO(date);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "14 Sep 2026" */
export function formatFullDate(date: string): string {
  return `${formatDay(date)} ${date.slice(0, 4)}`;
}

export function weekday(date: string): string {
  return WEEKDAYS[parseISO(date).getDay()];
}

/** "September 2026", or "Sep 26" when short. */
export function formatMonth(month: string, short = false): string {
  const [y, m] = month.split("-").map(Number);
  return short ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : `${MONTHS_LONG[m - 1]} ${y}`;
}

export function monthName(monthIndex1: number, short = false): string {
  return (short ? MONTHS_SHORT : MONTHS_LONG)[monthIndex1 - 1];
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / DAY_MS);
}

/** Human length of a span: "12 days", "5 mo", "2 yr 3 mo". Inclusive of both ends. */
export function spanLabel(from: string, to: string): string {
  const days = daysBetween(from, to) + 1;
  if (days < 45) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months} mo`;
  return rest ? `${years} yr ${rest} mo` : `${years} yr`;
}
