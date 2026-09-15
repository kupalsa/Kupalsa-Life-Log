import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import VersionForm from "../components/VersionForm";
import { NOTE_SECTIONS } from "../lib/releaseNotes";
import { formatFullDate, spanLabel, todayISO } from "../lib/dates";
import { levelAt } from "../lib/ladders";
import { formatMoney } from "../lib/money";
import { incomeInSpan, momentsInSpan, suggestNextName, versionSpans } from "../lib/versions";
import { emptyNotes, newId, noteLines, type Version } from "../lib/types";

export default function VersionsPage() {
  const { doc, ready } = useData();
  const today = todayISO();
  const [editing, setEditing] = useState<{ version: Version; isNew: boolean } | null>(null);
  const { currency } = doc;

  const rows = useMemo(() => {
    const spans = versionSpans(doc.versions);
    return spans.map((span, i) => {
      const moments = momentsInSpan(span, doc.moments);
      const income = incomeInSpan(spans, span, doc.income);
      const prevAvg = i > 0 ? incomeInSpan(spans, spans[i - 1], doc.income).avg : null;
      const endDate = span.end ?? today;
      return {
        span,
        moments,
        big: moments.filter((m) => m.big),
        levels: moments.filter((m) => m.ladder),
        income,
        incomeDelta: income.avg !== null && prevAvg ? ((income.avg - prevAvg) / Math.abs(prevAvg)) * 100 : null,
        ladderLevels: doc.ladders.map((l) => levelAt(l, doc.moments, endDate)),
        future: span.start > today,
      };
    });
  }, [doc.versions, doc.moments, doc.income, doc.ladders, today]);

  const maxAvg = Math.max(0, ...rows.map((r) => r.income.avg ?? 0));
  const anyIncome = rows.some((r) => r.income.months.length > 0);
  const laddersUsed = doc.ladders.filter((_, i) => rows.some((r) => r.ladderLevels[i]));

  function release() {
    setEditing({
      version: { id: newId(), name: suggestNextName(doc.versions), startDate: today, headline: "", note: "", notes: emptyNotes() },
      isNew: true,
    });
  }

  return (
    <div className="page versions-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Versions of you</p>
          <h1 className="display">Release history</h1>
          <p className="subtitle">
            Every so often you're a noticeably different person. Ship it as a new version, with
            release notes.
          </p>
        </div>
        <button className="primary" onClick={release}>
          Release a new version
        </button>
      </header>

      {ready && rows.length === 0 && (
        <div className="card empty-card">
          <p className="empty-title">Write yourself like software.</p>
          <p>
            Look back and name the releases: <b>1.0</b> was who you were when it started, <b>2.0</b> the
            one who changed something real, <b>3.0</b> is now. Each gets a codename and release notes —
            what's <b>New</b>, <b>Improved</b>, <b>Fixed</b>, <b>Removed</b>, and the <b>Known issues</b> you
            carry into the next version. When you release the next one, you tick off which known issues
            it fixed.
          </p>
          <button className="primary" onClick={release}>
            Release 1.0
          </button>
        </div>
      )}

      {rows.length > 1 && (
        <section className="card">
          <h2 className="card-title">Version diff</h2>
          <div className="table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Length</th>
                  <th className="num">Moments</th>
                  <th className="num">★</th>
                  {laddersUsed.map((l) => (
                    <th key={l.id} className="num">
                      {l.name}
                    </th>
                  ))}
                  {anyIncome && <th className="bar-col">Avg / month</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ span, moments, big, income, ladderLevels, future }) => (
                  <tr key={span.version.id}>
                    <th>
                      <span className="version-name">{span.version.name}</span>
                      {span.end === null && !future && <span className="pill current">now</span>}
                    </th>
                    <td className="muted">{future ? "later" : spanLabel(span.start, span.end ?? today)}</td>
                    <td className="num">{moments.length}</td>
                    <td className="num">{big.length}</td>
                    {laddersUsed.map((l) => (
                      <td key={l.id} className="num level-cell">
                        {ladderLevels[doc.ladders.indexOf(l)] ?? "—"}
                      </td>
                    ))}
                    {anyIncome && (
                      <td className="bar-col">
                        {income.avg !== null ? (
                          <span className="inline-bar">
                            <span className={income.avg < 0 ? "fill neg" : "fill"} style={{ width: `${maxAvg > 0 ? (Math.max(0, income.avg) / maxAvg) * 100 : 0}%` }} />
                            <span className="inline-value">{formatMoney(income.avg, currency)}</span>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="release-list">
        {[...rows].reverse().map(({ span, moments, big, levels, income, incomeDelta, future }) => {
          const current = span.end === null && !future;
          const sections = NOTE_SECTIONS.map((s) => ({ ...s, items: noteLines(span.version.notes[s.key]) })).filter((s) => s.items.length);
          return (
            <article key={span.version.id} className={`card release ${current ? "current" : ""}`}>
              <div className="release-head">
                <div className="release-name">{span.version.name}</div>
                <div className="release-meta">
                  {span.version.headline && (
                    <div className="release-codename" dir="auto">
                      “{span.version.headline}”
                    </div>
                  )}
                  <div className="muted">
                    {current && <span className="pill current">Current</span>} Released {formatFullDate(span.start)}
                    {span.end && ` · succeeded ${formatFullDate(span.end)}`}
                    {!future && ` · ${spanLabel(span.start, span.end ?? today)}`}
                  </div>
                </div>
                <button className="ghost" onClick={() => setEditing({ version: span.version, isNew: false })}>
                  Edit
                </button>
              </div>

              {span.version.note && (
                <p className="release-story" dir="auto">
                  {span.version.note}
                </p>
              )}

              {sections.length > 0 && (
                <div className="changelog">
                  {sections.map((s) => (
                    <div key={s.key} className={`changelog-group note-${s.key}`}>
                      <h3>
                        <span className="note-mark">{s.mark}</span> {s.label}
                      </h3>
                      <ul>
                        {s.items.map((item) => (
                          <li key={item} dir="auto">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="shipped">
                <span>
                  <b>{moments.length}</b> moments
                </span>
                <span>
                  <b>{big.length}</b> turning points
                </span>
                {levels.length > 0 && (
                  <span>
                    <b>{levels.map((m) => m.ladder!.level).join(" → ")}</b> reached
                  </span>
                )}
                {income.avg !== null && (
                  <span>
                    <b>{formatMoney(income.avg, currency)}</b> avg / month
                    {incomeDelta !== null && (
                      <span className={incomeDelta >= 0 ? "up" : "down"}>
                        {" "}
                        {incomeDelta >= 0 ? "▲" : "▼"} {Math.abs(incomeDelta).toFixed(0)}%
                      </span>
                    )}
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
          );
        })}
      </div>

      {editing && <VersionForm key={editing.version.id} version={editing.version} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}
