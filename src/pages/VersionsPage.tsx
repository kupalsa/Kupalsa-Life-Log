import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import VersionForm from "../components/VersionForm";
import { formatFullDate, spanLabel, todayISO } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { incomeInSpan, momentsInSpan, suggestNextName, versionSpans } from "../lib/versions";
import { newId, type Version } from "../lib/types";

export default function VersionsPage() {
  const { doc, ready } = useData();
  const today = todayISO();
  const [editing, setEditing] = useState<{ version: Version; isNew: boolean } | null>(null);
  const { currency } = doc;

  const rows = useMemo(() => {
    const spans = versionSpans(doc.versions);
    return spans.map((span) => {
      const moments = momentsInSpan(span, doc.moments);
      return {
        span,
        moments,
        big: moments.filter((m) => m.big),
        income: incomeInSpan(spans, span, doc.income),
        future: span.start > today,
      };
    });
  }, [doc.versions, doc.moments, doc.income, today]);

  const maxAvg = Math.max(0, ...rows.map((r) => r.income.avg ?? 0));
  const anyIncome = rows.some((r) => r.income.months.length > 0);

  function startNew() {
    setEditing({
      version: { id: newId(), name: suggestNextName(doc.versions), startDate: today, headline: "", note: "" },
      isNew: true,
    });
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Versions</h1>
          <p className="subtitle">
            Chapters of you. A new version starts when you decide something real has changed.
          </p>
        </div>
        <button className="primary" onClick={startNew}>
          + New version
        </button>
      </header>

      {ready && rows.length === 0 && (
        <div className="empty">
          <p className="empty-title">No versions yet.</p>
          <p>
            Look back and name the chapters: v5 was one life, v6 another, v7 is now. Give each a
            start date and one line on who you were. Moments and income fall into place under
            them, and this page shows how each version compares.
          </p>
          <button className="primary" onClick={startNew}>
            Name your first version
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <section className="panel">
          <h2>Progress across versions</h2>
          <div className="table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Length</th>
                  <th className="num">Moments</th>
                  <th className="num">★</th>
                  {anyIncome && <th className="bar-col">Avg / month</th>}
                  {anyIncome && <th className="num">Total made</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ span, moments, big, income, future }) => (
                  <tr key={span.version.id}>
                    <th>
                      <span className="version-name">{span.version.name}</span>
                      {span.end === null && !future && <span className="pill current">now</span>}
                    </th>
                    <td className="muted">{future ? "starts later" : spanLabel(span.start, span.end ?? today)}</td>
                    <td className="num">{moments.length}</td>
                    <td className="num">{big.length}</td>
                    {anyIncome && (
                      <td className="bar-col">
                        {income.avg !== null ? (
                          <span className="inline-bar">
                            <span
                              className={income.avg < 0 ? "fill neg" : "fill"}
                              style={{ width: `${maxAvg > 0 ? (Math.max(0, income.avg) / maxAvg) * 100 : 0}%` }}
                            />
                            <span className="inline-value">{formatMoney(income.avg, currency)}</span>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    )}
                    {anyIncome && (
                      <td className="num">{income.months.length ? formatMoney(income.total, currency) : "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="version-cards">
        {[...rows].reverse().map(({ span, moments, big, income, future }) => (
          <article key={span.version.id} className={span.end === null && !future ? "panel version-card current" : "panel version-card"}>
            <div className="version-card-head">
              <span className="version-big">{span.version.name}</span>
              <div className="version-card-meta">
                {span.version.headline && (
                  <div className="version-card-headline" dir="auto">
                    {span.version.headline}
                  </div>
                )}
                <div className="muted">
                  {formatFullDate(span.start)} → {span.end ? formatFullDate(span.end) : "now"}
                  {!future && ` · ${spanLabel(span.start, span.end ?? today)}`}
                </div>
              </div>
              <button className="ghost" onClick={() => setEditing({ version: span.version, isNew: false })}>
                Edit
              </button>
            </div>

            {span.version.note && (
              <p className="version-note" dir="auto">
                {span.version.note}
              </p>
            )}

            <div className="version-stats">
              <span>
                <b>{moments.length}</b> moments
              </span>
              <span>
                <b>{big.length}</b> turning points
              </span>
              {income.avg !== null && (
                <span>
                  <b>{formatMoney(income.avg, currency)}</b> avg / month
                </span>
              )}
            </div>

            {big.length > 0 && (
              <ul className="turning-points">
                {big.map((m) => (
                  <li key={m.id}>
                    <span className="tp-date">{formatFullDate(m.date)}</span>
                    <span dir="auto">{m.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      {editing && (
        <VersionForm
          key={editing.version.id}
          version={editing.version}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
