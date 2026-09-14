import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import QuickAdd from "../components/QuickAdd";
import MomentForm from "../components/MomentForm";
import { AreaPicker, AreaTag } from "../components/Area";
import {
  daysBetween,
  formatFullDate,
  formatMonth,
  monthOf,
  parseISO,
  spanLabel,
  todayISO,
  weekday,
} from "../lib/dates";
import { spanAt, versionSpans, type VersionSpan } from "../lib/versions";
import { formatMoney } from "../lib/money";
import type { IncomeMonth, Moment } from "../lib/types";

type Item =
  | { kind: "version"; key: string; span: VersionSpan | null }
  | { kind: "month"; key: string; month: string; income: IncomeMonth | undefined }
  | { kind: "moment"; key: string; moment: Moment };

export default function TimelinePage() {
  const { doc, ready } = useData();
  const today = todayISO();
  const [editing, setEditing] = useState<Moment | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [bigOnly, setBigOnly] = useState(false);
  const [query, setQuery] = useState("");

  const spans = useMemo(() => versionSpans(doc.versions), [doc.versions]);
  const current = spanAt(spans, today);
  const incomeByMonth = useMemo(() => new Map(doc.income.map((i) => [i.month, i])), [doc.income]);

  const usedAreas = useMemo(() => {
    const used = new Set(doc.moments.map((m) => m.area));
    return [...doc.areas.filter((a) => used.has(a)), ...[...used].filter((a) => !doc.areas.includes(a))];
  }, [doc.moments, doc.areas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doc.moments.filter(
      (m) =>
        (!areaFilter || m.area === areaFilter) &&
        (!bigOnly || m.big) &&
        (!q || m.title.toLowerCase().includes(q) || m.note.toLowerCase().includes(q)),
    );
  }, [doc.moments, areaFilter, bigOnly, query]);

  const items = useMemo(() => {
    const out: Item[] = [];
    let lastVersion: string | undefined;
    let lastMonth: string | undefined;
    for (const m of filtered) {
      const span = spanAt(spans, m.date);
      const vKey = span?.version.id ?? "before";
      const month = monthOf(m.date);
      if (spans.length && vKey !== lastVersion) {
        out.push({ kind: "version", key: `v-${vKey}`, span });
        lastMonth = undefined;
      }
      if (month !== lastMonth) {
        out.push({ kind: "month", key: `m-${vKey}-${month}`, month, income: incomeByMonth.get(month) });
      }
      out.push({ kind: "moment", key: m.id, moment: m });
      lastVersion = vKey;
      lastMonth = month;
    }
    return out;
  }, [filtered, spans, incomeByMonth]);

  // Same calendar days in earlier years, give or take three days.
  const echoes = useMemo(() => {
    const year = Number(today.slice(0, 4));
    return doc.moments
      .filter((m) => {
        if (Number(m.date.slice(0, 4)) >= year) return false;
        return Math.abs(daysBetween(`${year}${m.date.slice(4)}`, today)) <= 3;
      })
      .slice(0, 6);
  }, [doc.moments, today]);

  const bigCount = doc.moments.filter((m) => m.big).length;
  const filtering = areaFilter !== null || bigOnly || query.trim() !== "";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Timeline</h1>
          <p className="subtitle">
            {doc.moments.length} moment{doc.moments.length === 1 ? "" : "s"} · {bigCount} turning
            point{bigCount === 1 ? "" : "s"}
          </p>
        </div>
        {current ? (
          <Link to="/versions" className="now-pill">
            <span className="now-label">Now</span>
            <b>{current.version.name}</b>
            {current.version.headline && <span className="now-headline">{current.version.headline}</span>}
            <span className="muted">{spanLabel(current.start, today)} in</span>
          </Link>
        ) : (
          ready && (
            <Link to="/versions" className="now-pill empty">
              Name the version of you living this →
            </Link>
          )
        )}
      </header>

      <QuickAdd />

      {echoes.length > 0 && (
        <section className="panel echoes">
          <h2>On this day</h2>
          {echoes.map((m) => {
            const years = Number(today.slice(0, 4)) - Number(m.date.slice(0, 4));
            return (
              <button key={m.id} className="echo" onClick={() => setEditing(m)}>
                <span className="echo-when">
                  {years} year{years === 1 ? "" : "s"} ago
                </span>
                <span className="echo-title" dir="auto">
                  {m.big && <span className="star">★ </span>}
                  {m.title}
                </span>
                <AreaTag areas={doc.areas} area={m.area} />
              </button>
            );
          })}
        </section>
      )}

      {!ready && <div className="empty">Loading your log…</div>}

      {ready && doc.moments.length === 0 && (
        <div className="empty">
          <p className="empty-title">Nothing logged yet.</p>
          <p>
            Only log what you'll want to remember in a year: a relationship turning, a first, a
            decision, a win, a loss that taught you something. Skipping weeks is fine. It doesn't
            have to be today's news either — set the date to when it happened.
          </p>
        </div>
      )}

      {doc.moments.length > 0 && (
        <div className="filters">
          <AreaPicker
            areas={usedAreas}
            palette={doc.areas}
            value={areaFilter}
            onChange={setAreaFilter}
            allowAll
          />
          <div className="row">
            <button
              className={bigOnly ? "toggle on" : "toggle"}
              aria-pressed={bigOnly}
              onClick={() => setBigOnly(!bigOnly)}
            >
              ★ Turning points
            </button>
            <input
              type="search"
              className="search"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search moments"
            />
          </div>
        </div>
      )}

      {filtering && filtered.length === 0 && <div className="empty">No moments match.</div>}

      <div className="timeline">
        {items.map((item) => {
          if (item.kind === "version") {
            const s = item.span;
            return (
              <div key={item.key} className="version-divider">
                {s ? (
                  <>
                    <span className="version-name">{s.version.name}</span>
                    <span className="version-headline" dir="auto">
                      {s.version.headline}
                    </span>
                    <span className="version-range">
                      {formatFullDate(s.start)} → {s.end ? formatFullDate(s.end) : "now"}
                    </span>
                  </>
                ) : (
                  <span className="version-headline muted">Before {spans[0].version.name}</span>
                )}
              </div>
            );
          }
          if (item.kind === "month") {
            return (
              <div key={item.key} className="month-head">
                <span>{formatMonth(item.month)}</span>
                {item.income && (
                  <Link to={`/money?month=${item.month}`} className="month-income" title="Income this month">
                    {formatMoney(item.income.amount, doc.currency)}
                  </Link>
                )}
              </div>
            );
          }
          const m = item.moment;
          return (
            <button key={item.key} className={m.big ? "moment big" : "moment"} onClick={() => setEditing(m)}>
              <span className="moment-date">
                <b>{parseISO(m.date).getDate()}</b>
                <small>{weekday(m.date)}</small>
              </span>
              <span className="moment-body">
                <span className="moment-title" dir="auto">
                  {m.big && (
                    <span className="star" aria-label="Turning point">
                      ★{" "}
                    </span>
                  )}
                  {m.title}
                </span>
                {m.note && (
                  <span className="moment-note" dir="auto">
                    {m.note}
                  </span>
                )}
              </span>
              <AreaTag areas={doc.areas} area={m.area} />
            </button>
          );
        })}
      </div>

      {editing && <MomentForm key={editing.id} moment={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
