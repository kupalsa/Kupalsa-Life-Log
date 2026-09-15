import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import QuickAdd from "../components/QuickAdd";
import MomentForm from "../components/MomentForm";
import { AreaTag } from "../components/Area";
import { PhotoImg } from "../components/Photos";
import { daysBetween, formatFullDate, formatMonth, monthOf, spanLabel, todayISO } from "../lib/dates";
import { ladderProgress, stepLabel } from "../lib/ladders";
import { formatMoney } from "../lib/money";
import { thenAndNow } from "../lib/progress";
import { spanAt, versionSpans } from "../lib/versions";
import { noteLines, type Moment } from "../lib/types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function NowPage() {
  const { doc, ready } = useData();
  const today = todayISO();
  const [editing, setEditing] = useState<Moment | null>(null);

  const spans = useMemo(() => versionSpans(doc.versions), [doc.versions]);
  const current = spanAt(spans, today);
  const compare = useMemo(() => thenAndNow(doc, today), [doc, today]);
  const ladders = useMemo(() => doc.ladders.map((l) => ladderProgress(l, doc.moments)), [doc.ladders, doc.moments]);

  const echoes = useMemo(() => {
    const year = Number(today.slice(0, 4));
    return doc.moments
      .filter((m) => Number(m.date.slice(0, 4)) < year && Math.abs(daysBetween(`${year}${m.date.slice(4)}`, today)) <= 3)
      .slice(0, 4);
  }, [doc.moments, today]);

  const recent = doc.moments.slice(0, 4);
  const thisMonth = doc.income.find((i) => i.month === monthOf(today));
  const knownIssues = current ? noteLines(current.version.notes.known) : [];

  return (
    <div className="page now-page">
      <header className="now-hero">
        <p className="eyebrow">
          {greeting()} · {formatFullDate(today)}
        </p>
        {current ? (
          <h1 className="display">
            You're running <span className="accent-text">{current.version.name}</span>
            {current.version.headline && (
              <span className="display-soft" dir="auto">
                {" "}
                — {current.version.headline}
              </span>
            )}
          </h1>
        ) : (
          <h1 className="display">What's worth remembering?</h1>
        )}
        {current && (
          <p className="subtitle">
            Released {formatFullDate(current.start)} · {spanLabel(current.start, today)} in ·{" "}
            <Link to="/versions">release notes</Link>
          </p>
        )}
      </header>

      <QuickAdd />

      <div className="now-grid">
        {compare && compare.rows.length > 0 && (
          <section className="card then-now">
            <h2 className="card-title">Then → Now</h2>
            <div className="then-now-head">
              <span />
              <span>{compare.label}</span>
              <span>Today</span>
            </div>
            {compare.rows.map((r) => (
              <div key={r.label} className="then-now-row">
                <span className="tn-label">{r.label}</span>
                <span className="tn-then">{r.then ?? "—"}</span>
                <span className={`tn-now ${r.up === true ? "up" : r.up === false ? "down" : ""}`}>
                  {r.up === true && <span aria-label="up">▲ </span>}
                  {r.up === false && <span aria-label="down">▼ </span>}
                  {r.now ?? "—"}
                </span>
              </div>
            ))}
          </section>
        )}

        {ladders.length > 0 && (
          <section className="card">
            <h2 className="card-title">
              Ladders <Link to="/ladders" className="card-link">All →</Link>
            </h2>
            {ladders.map((p) => (
              <Link key={p.ladder.id} to="/ladders" className="ladder-mini">
                <span className="ladder-mini-name">{p.ladder.name}</span>
                <span className="ladder-mini-level">{p.top?.level ?? "—"}</span>
                <span className="muted">
                  {p.top?.moment
                    ? `since ${formatFullDate(p.top.moment.date)} · ${stepLabel(daysBetween(p.top.moment.date, today))}`
                    : "No level logged yet"}
                </span>
                {p.next && <span className="ladder-mini-next">next {p.next}</span>}
              </Link>
            ))}
          </section>
        )}

        {knownIssues.length > 0 && (
          <section className="card">
            <h2 className="card-title">Working on in {current!.version.name}</h2>
            <ul className="issue-list">
              {knownIssues.map((k) => (
                <li key={k} dir="auto">
                  {k}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <h2 className="card-title">
            {formatMonth(monthOf(today))} <Link to="/money" className="card-link">Money →</Link>
          </h2>
          {thisMonth ? (
            <div className="big-number">{formatMoney(thisMonth.amount, doc.currency)}</div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Not logged yet. Whenever you know the number — <Link to="/money">add it</Link>.
            </p>
          )}
        </section>
      </div>

      {echoes.length > 0 && (
        <section className="card echoes">
          <h2 className="card-title">On this day</h2>
          {echoes.map((m) => {
            const years = Number(today.slice(0, 4)) - Number(m.date.slice(0, 4));
            return (
              <button key={m.id} className="echo" onClick={() => setEditing(m)}>
                {m.photos[0] && <PhotoImg photo={m.photos[0]} alt="" className="echo-thumb" />}
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

      {ready && recent.length > 0 && (
        <section className="recent">
          <h2 className="section-title">
            Latest <Link to="/story" className="card-link">Read the whole story →</Link>
          </h2>
          <div className="recent-grid">
            {recent.map((m) => (
              <button key={m.id} className="recent-card" onClick={() => setEditing(m)}>
                {m.photos[0] ? <PhotoImg photo={m.photos[0]} alt="" className="recent-photo" /> : <span className="recent-photo blank">{m.ladder?.level ?? (m.big ? "★" : "")}</span>}
                <span className="recent-date">{formatFullDate(m.date)}</span>
                <span className="recent-title" dir="auto">
                  {m.title}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {ready && doc.moments.length === 0 && (
        <div className="empty">
          <p className="empty-title">Nothing logged yet — and that's fine.</p>
          <p>
            Only log what you'll want to remember in a year: a first, a send, a decision, a
            relationship turning. Add a photo when you have one. Skipping weeks is normal.
          </p>
        </div>
      )}

      {editing && <MomentForm key={editing.id} moment={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
