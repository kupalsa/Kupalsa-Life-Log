/** A picture attached to a moment. */
export interface Photo {
  id: string;
  /** "photos/2026/<id>.jpg" in the data repo, or "local:<id>" while browser-only. */
  path: string;
  w: number;
  h: number;
}

/** Something that happened and is worth remembering. Not a habit tracker entry. */
export interface Moment {
  id: string;
  /** YYYY-MM-DD, local. */
  date: string;
  title: string;
  note: string;
  area: string;
  /** A turning point — shown prominently and listed on its version. */
  big: boolean;
  photos: Photo[];
  /** Set when this moment is reaching a new level on a ladder (e.g. first V7 send). */
  ladder: { ladderId: string; level: string } | null;
  createdAt: string;
}

/** An ordered scale you climb over years — bouldering grades, race distances, anything. */
export interface Ladder {
  id: string;
  name: string;
  /** Lowest first. */
  levels: string[];
  area: string;
  createdAt: string;
}

/** A version of you, written like software release notes. One item per line. */
export interface ReleaseNotes {
  added: string;
  improved: string;
  fixed: string;
  removed: string;
  known: string;
}

/**
 * A chapter of life ("1.0", "2.0"). A version runs from its start date until
 * the next version starts; the latest one is ongoing.
 */
export interface Version {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** The codename — who you are in this version, in one line. */
  headline: string;
  note: string;
  notes: ReleaseNotes;
}

export interface IncomeMonth {
  /** YYYY-MM */
  month: string;
  amount: number;
  note: string;
}

/** The whole log lives in one small JSON document. Photos live beside it. */
export interface LifeDoc {
  schema: 2;
  moments: Moment[];
  versions: Version[];
  ladders: Ladder[];
  income: IncomeMonth[];
  areas: string[];
  currency: string;
}

export const DEFAULT_AREAS = [
  "Relationships",
  "Climbing",
  "Trading",
  "Work",
  "Money",
  "Health",
  "Growth",
  "Family",
];

export const DEFAULT_CURRENCY = "₪";

export const BOULDERING_LEVELS = Array.from({ length: 18 }, (_, i) => `V${i}`);

export function emptyNotes(): ReleaseNotes {
  return { added: "", improved: "", fixed: "", removed: "", known: "" };
}

export function defaultLadders(): Ladder[] {
  return [
    {
      id: "bouldering",
      name: "Bouldering",
      levels: [...BOULDERING_LEVELS],
      area: "Climbing",
      createdAt: new Date(0).toISOString(),
    },
  ];
}

export function emptyDoc(): LifeDoc {
  return {
    schema: 2,
    moments: [],
    versions: [],
    ladders: defaultLadders(),
    income: [],
    areas: [...DEFAULT_AREAS],
    currency: DEFAULT_CURRENCY,
  };
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);

function normalizePhoto(p: unknown): Photo | null {
  if (!isObj(p) || typeof p.path !== "string" || !p.path) return null;
  return {
    id: str(p.id) || newId(),
    path: p.path,
    w: Number(p.w) || 0,
    h: Number(p.h) || 0,
  };
}

/**
 * Accepts whatever is stored (hand-edited in GitHub, or from an older build)
 * and returns a well-formed doc. Schema 1 docs upgrade in place. Records that
 * can't be placed in time are dropped rather than crashing the app.
 */
export function normalizeDoc(raw: unknown): LifeDoc {
  const base = emptyDoc();
  if (!isObj(raw)) return base;

  const moments = arr(raw.moments)
    .filter((m): m is Obj => isObj(m) && isDate(m.date))
    .map<Moment>((m) => ({
      id: str(m.id) || newId(),
      date: m.date as string,
      title: str(m.title),
      note: str(m.note),
      area: str(m.area, "Other") || "Other",
      big: Boolean(m.big),
      photos: arr(m.photos).map(normalizePhoto).filter((p): p is Photo => p !== null),
      ladder:
        isObj(m.ladder) && typeof m.ladder.ladderId === "string" && typeof m.ladder.level === "string"
          ? { ladderId: m.ladder.ladderId, level: m.ladder.level }
          : null,
      createdAt: str(m.createdAt) || new Date().toISOString(),
    }))
    .sort(byDateDesc);

  const versions = arr(raw.versions)
    .filter((v): v is Obj => isObj(v) && isDate(v.startDate))
    .map<Version>((v) => {
      const n = isObj(v.notes) ? v.notes : {};
      return {
        id: str(v.id) || newId(),
        name: str(v.name) || "?",
        startDate: v.startDate as string,
        headline: str(v.headline),
        note: str(v.note),
        notes: {
          added: str(n.added),
          improved: str(n.improved),
          fixed: str(n.fixed),
          removed: str(n.removed),
          known: str(n.known),
        },
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Schema 1 had no ladders: give it the default set. An explicit empty list stays empty.
  const ladders = Array.isArray(raw.ladders)
    ? raw.ladders
        .filter((l): l is Obj => isObj(l) && typeof l.name === "string")
        .map<Ladder>((l) => ({
          id: str(l.id) || newId(),
          name: str(l.name),
          levels: arr(l.levels).filter((x): x is string => typeof x === "string" && x.trim() !== ""),
          area: str(l.area),
          createdAt: str(l.createdAt) || new Date().toISOString(),
        }))
    : base.ladders;

  const seenMonths = new Set<string>();
  const income = arr(raw.income)
    .filter((i): i is Obj => isObj(i) && isMonth(i.month) && Number.isFinite(Number(i.amount)))
    .map<IncomeMonth>((i) => ({ month: i.month as string, amount: Number(i.amount), note: str(i.note) }))
    .filter((i) => !seenMonths.has(i.month) && seenMonths.add(i.month))
    .sort((a, b) => a.month.localeCompare(b.month));

  const areas = Array.isArray(raw.areas)
    ? raw.areas.filter((a): a is string => typeof a === "string" && a.trim() !== "")
    : base.areas;

  return {
    schema: 2,
    moments,
    versions,
    ladders,
    income,
    areas: areas.length ? areas : base.areas,
    currency: str(raw.currency) || base.currency,
  };
}

/** Newest first; same-day moments newest-written first. */
export function byDateDesc(a: Moment, b: Moment): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

export function docHasContent(doc: LifeDoc): boolean {
  return doc.moments.length + doc.versions.length + doc.income.length > 0;
}

/**
 * Folds `incoming` into `base` by id (moments, versions, ladders) and by month
 * (income). On a clash `base` wins — used to move browser-only entries into
 * GitHub without overwriting anything already there.
 */
export function mergeDocs(base: LifeDoc, incoming: LifeDoc): LifeDoc {
  const ids = <T extends { id: string }>(xs: T[]) => new Set(xs.map((x) => x.id));
  const momentIds = ids(base.moments);
  const versionIds = ids(base.versions);
  const ladderIds = ids(base.ladders);
  const months = new Set(base.income.map((i) => i.month));
  return normalizeDoc({
    ...base,
    moments: [...base.moments, ...incoming.moments.filter((m) => !momentIds.has(m.id))],
    versions: [...base.versions, ...incoming.versions.filter((v) => !versionIds.has(v.id))],
    ladders: [...base.ladders, ...incoming.ladders.filter((l) => !ladderIds.has(l.id))],
    income: [...base.income, ...incoming.income.filter((i) => !months.has(i.month))],
    areas: [...base.areas, ...incoming.areas.filter((a) => !base.areas.includes(a))],
  });
}

/** Release-note text → trimmed, non-empty lines. */
export function noteLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}
