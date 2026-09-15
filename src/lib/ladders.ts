import { daysBetween } from "./dates";
import type { Ladder, Moment } from "./types";

export interface Rung {
  level: string;
  index: number;
  /** The first moment that reached this level, if any. */
  moment: Moment | null;
  /** Days since the previous reached rung — how long this step took. */
  daysFromPrevious: number | null;
}

export interface LadderProgress {
  ladder: Ladder;
  rungs: Rung[];
  /** Highest reached rung, or null before the first send. */
  top: Rung | null;
  next: string | null;
}

/**
 * For each level, the earliest moment that logged it. Reaching V7 before ever
 * logging V6 is allowed — the V6 rung just stays unmarked.
 */
export function ladderProgress(ladder: Ladder, moments: Moment[]): LadderProgress {
  const firsts = new Map<string, Moment>();
  for (const m of moments) {
    if (m.ladder?.ladderId !== ladder.id) continue;
    const seen = firsts.get(m.ladder.level);
    if (!seen || m.date < seen.date) firsts.set(m.ladder.level, m);
  }

  let prevDate: string | null = null;
  const rungs = ladder.levels.map<Rung>((level, index) => {
    const moment = firsts.get(level) ?? null;
    const rung: Rung = {
      level,
      index,
      moment,
      daysFromPrevious: moment && prevDate ? daysBetween(prevDate, moment.date) : null,
    };
    if (moment) prevDate = moment.date;
    return rung;
  });

  const reached = rungs.filter((r) => r.moment);
  const top = reached.length ? reached[reached.length - 1] : null;
  return {
    ladder,
    rungs,
    top,
    next: top ? (ladder.levels[top.index + 1] ?? null) : (ladder.levels[0] ?? null),
  };
}

/** The level held on a given date — for "a year ago you climbed V5". */
export function levelAt(ladder: Ladder, moments: Moment[], date: string): string | null {
  let best = -1;
  for (const m of moments) {
    if (m.ladder?.ladderId !== ladder.id || m.date > date) continue;
    best = Math.max(best, ladder.levels.indexOf(m.ladder.level));
  }
  return best >= 0 ? ladder.levels[best] : null;
}

/** "3 mo", "1 yr 2 mo", "12 days" for a step duration. */
export function stepLabel(days: number): string {
  if (days < 45) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  const y = Math.floor(months / 12);
  const r = months % 12;
  return y ? `${y} yr${r ? ` ${r} mo` : ""}` : `${months} mo`;
}
