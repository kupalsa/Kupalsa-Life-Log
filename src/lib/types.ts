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
  createdAt: string;
}

/**
 * A chapter of life ("v5", "v6", "v7"). A version runs from its start date
 * until the next version starts; the latest one is ongoing.
 */
export interface Version {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** Who you are / what this chapter is, in one line. */
  headline: string;
  note: string;
}

export interface IncomeMonth {
  /** YYYY-MM */
  month: string;
  amount: number;
  note: string;
}

/** The whole log lives in one small JSON document. */
export interface LifeDoc {
  schema: 1;
  moments: Moment[];
  versions: Version[];
  income: IncomeMonth[];
  areas: string[];
  currency: string;
}

export const DEFAULT_AREAS = [
  "Relationships",
  "Trading",
  "Work",
  "Money",
  "Health",
  "Growth",
  "Family",
  "Other",
];

export const DEFAULT_CURRENCY = "₪";

export function emptyDoc(): LifeDoc {
  return {
    schema: 1,
    moments: [],
    versions: [],
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

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);

/**
 * Accepts whatever is stored (hand-edited in GitHub, or from an older build)
 * and returns a well-formed doc. Records that can't be placed in time are
 * dropped rather than crashing the app.
 */
export function normalizeDoc(raw: unknown): LifeDoc {
  const base = emptyDoc();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Record<keyof LifeDoc, unknown>>;

  const moments = (Array.isArray(r.moments) ? r.moments : [])
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && isDate(m.date))
    .map<Moment>((m) => ({
      id: str(m.id) || newId(),
      date: m.date as string,
      title: str(m.title),
      note: str(m.note),
      area: str(m.area, "Other") || "Other",
      big: Boolean(m.big),
      createdAt: str(m.createdAt) || new Date().toISOString(),
    }))
    .sort(byDateDesc);

  const versions = (Array.isArray(r.versions) ? r.versions : [])
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && isDate(v.startDate))
    .map<Version>((v) => ({
      id: str(v.id) || newId(),
      name: str(v.name) || "v?",
      startDate: v.startDate as string,
      headline: str(v.headline),
      note: str(v.note),
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const seenMonths = new Set<string>();
  const income = (Array.isArray(r.income) ? r.income : [])
    .filter(
      (i): i is Record<string, unknown> =>
        !!i && typeof i === "object" && isMonth(i.month) && Number.isFinite(Number(i.amount)),
    )
    .map<IncomeMonth>((i) => ({
      month: i.month as string,
      amount: Number(i.amount),
      note: str(i.note),
    }))
    .filter((i) => !seenMonths.has(i.month) && seenMonths.add(i.month))
    .sort((a, b) => a.month.localeCompare(b.month));

  const areas = Array.isArray(r.areas)
    ? r.areas.filter((a): a is string => typeof a === "string" && a.trim() !== "")
    : base.areas;

  return {
    schema: 1,
    moments,
    versions,
    income,
    areas: areas.length ? areas : base.areas,
    currency: str(r.currency) || base.currency,
  };
}

/** Newest first; same-day moments in the order they were written. */
export function byDateDesc(a: Moment, b: Moment): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

export function docHasContent(doc: LifeDoc): boolean {
  return doc.moments.length + doc.versions.length + doc.income.length > 0;
}

/**
 * Folds `incoming` into `base` by id (moments, versions) and by month (income).
 * On a clash `base` wins — used to move browser-only entries into GitHub
 * without overwriting anything already there.
 */
export function mergeDocs(base: LifeDoc, incoming: LifeDoc): LifeDoc {
  const momentIds = new Set(base.moments.map((m) => m.id));
  const versionIds = new Set(base.versions.map((v) => v.id));
  const months = new Set(base.income.map((i) => i.month));
  return normalizeDoc({
    ...base,
    moments: [...base.moments, ...incoming.moments.filter((m) => !momentIds.has(m.id))],
    versions: [...base.versions, ...incoming.versions.filter((v) => !versionIds.has(v.id))],
    income: [...base.income, ...incoming.income.filter((i) => !months.has(i.month))],
    areas: [...base.areas, ...incoming.areas.filter((a) => !base.areas.includes(a))],
  });
}
