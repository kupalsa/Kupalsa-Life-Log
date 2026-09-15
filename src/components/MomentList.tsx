import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { formatFullDate, formatMonth, monthOf, parseISO, weekday } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { spanAt, versionSpans, type VersionSpan } from "../lib/versions";
import type { IncomeMonth, Moment } from "../lib/types";
import { AreaTag } from "./Area";
import { PhotoImg } from "./Photos";

type Item =
  | { kind: "version"; key: string; span: VersionSpan | null }
  | { kind: "month"; key: string; month: string; income: IncomeMonth | undefined }
  | { kind: "moment"; key: string; moment: Moment };

/** The compact, scannable view: grouped by version and month, income beside each month. */
export default function MomentList({ moments, onEdit }: { moments: Moment[]; onEdit: (m: Moment) => void }) {
  const { doc } = useData();
  const spans = useMemo(() => versionSpans(doc.versions), [doc.versions]);
  const incomeByMonth = useMemo(() => new Map(doc.income.map((i) => [i.month, i])), [doc.income]);

  const items = useMemo(() => {
    const out: Item[] = [];
    let lastVersion: string | undefined;
    let lastMonth: string | undefined;
    for (const m of moments) {
      const span = spanAt(spans, m.date);
      const vKey = span?.version.id ?? "before";
      const month = monthOf(m.date);
      if (spans.length && vKey !== lastVersion) {
        out.push({ kind: "version", key: `v-${vKey}`, span });
        lastMonth = undefined;
      }
      if (month !== lastMonth) out.push({ kind: "month", key: `m-${vKey}-${month}`, month, income: incomeByMonth.get(month) });
      out.push({ kind: "moment", key: m.id, moment: m });
      lastVersion = vKey;
      lastMonth = month;
    }
    return out;
  }, [moments, spans, incomeByMonth]);

  return (
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
          <button key={item.key} className={m.big ? "moment big" : "moment"} onClick={() => onEdit(m)}>
            <span className="moment-date">
              <b>{parseISO(m.date).getDate()}</b>
              <small>{weekday(m.date)}</small>
            </span>
            <span className="moment-body">
              <span className="moment-title" dir="auto">
                {m.big && <span className="star">★ </span>}
                {m.ladder && <span className="level-badge">{m.ladder.level}</span>}
                {m.title}
              </span>
              {m.note && (
                <span className="moment-note" dir="auto">
                  {m.note}
                </span>
              )}
            </span>
            <span className="moment-side">
              {m.photos[0] && <PhotoImg photo={m.photos[0]} alt="" className="moment-thumb" />}
              <AreaTag areas={doc.areas} area={m.area} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
