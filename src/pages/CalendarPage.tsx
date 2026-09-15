import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { areaColor } from "../lib/areas";
import { WEEKDAY_HEADERS, groupByDate, monthGrid } from "../lib/calendar";
import { formatFullDate, formatMonth, monthName, monthOf, shiftMonth, todayISO } from "../lib/dates";
import { compactMoney, formatMoney } from "../lib/money";
import type { Moment } from "../lib/types";
import QuickAdd from "../components/QuickAdd";
import MomentForm from "../components/MomentForm";
import { AreaTag } from "../components/Area";
import { PhotoImg } from "../components/Photos";

type Mode = "month" | "year";

export default function CalendarPage() {
  const { doc } = useData();
  const today = todayISO();
  const [mode, setMode] = useState<Mode>("month");
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Moment | null>(null);

  const byDate = useMemo(() => groupByDate([...doc.moments].reverse()), [doc.moments]);
  const releases = useMemo(() => new Map(doc.versions.map((v) => [v.startDate, v])), [doc.versions]);
  const incomeByMonth = useMemo(() => new Map(doc.income.map((i) => [i.month, i])), [doc.income]);
  const year = month.slice(0, 4);

  function step(delta: number) {
    setSelected(null);
    setMonth(mode === "month" ? shiftMonth(month, delta) : `${Number(year) + delta}-${month.slice(5)}`);
  }

  const yearStats = useMemo(() => {
    const ms = doc.moments.filter((m) => m.date.startsWith(year));
    return {
      moments: ms.length,
      big: ms.filter((m) => m.big).length,
      photos: ms.reduce((n, m) => n + m.photos.length, 0),
      levels: ms.filter((m) => m.ladder).length,
      income: doc.income.filter((i) => i.month.startsWith(year)).reduce((s, i) => s + i.amount, 0),
      logged: doc.income.filter((i) => i.month.startsWith(year)).length,
    };
  }, [doc.moments, doc.income, year]);

  const dayMoments = selected ? (byDate.get(selected) ?? []) : [];
  const monthIncome = incomeByMonth.get(month);

  return (
    <div className="page calendar-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1 className="display">{mode === "month" ? formatMonth(month) : year}</h1>
        </div>
        <div className="row">
          <div className="segmented" role="group" aria-label="View">
            <button className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>
              Month
            </button>
            <button className={mode === "year" ? "on" : ""} onClick={() => setMode("year")}>
              Year
            </button>
          </div>
          <button onClick={() => step(-1)} aria-label="Previous">
            ‹
          </button>
          <button
            onClick={() => {
              setMonth(monthOf(today));
              setSelected(null);
            }}
          >
            Today
          </button>
          <button onClick={() => step(1)} aria-label="Next">
            ›
          </button>
        </div>
      </header>

      {mode === "month" ? (
        <>
          <div className="cal-summary">
            <span>
              <b>{doc.moments.filter((m) => m.date.startsWith(month)).length}</b> moments
            </span>
            <span>
              <b>{monthIncome ? formatMoney(monthIncome.amount, doc.currency) : "—"}</b> made
            </span>
          </div>

          <div className="cal-grid" role="grid">
            {WEEKDAY_HEADERS.map((d) => (
              <div key={d} className="cal-weekday" role="columnheader">
                {d}
              </div>
            ))}
            {monthGrid(month).map((cell) => {
              const ms = byDate.get(cell.date) ?? [];
              const photo = ms.find((m) => m.photos.length)?.photos[0];
              const release = releases.get(cell.date);
              const cls = [
                "cal-day",
                cell.inMonth ? "" : "out",
                cell.date === today ? "today" : "",
                cell.date === selected ? "sel" : "",
                photo ? "has-photo" : "",
                ms.some((m) => m.big) ? "big" : "",
              ].join(" ");
              return (
                <button key={cell.date} className={cls} onClick={() => setSelected(cell.date === selected ? null : cell.date)} role="gridcell" aria-label={`${formatFullDate(cell.date)}, ${ms.length} moments`}>
                  {photo && <PhotoImg photo={photo} alt="" className="cal-photo" />}
                  <span className="cal-num">{Number(cell.date.slice(8))}</span>
                  {release && <span className="cal-release">{release.name}</span>}
                  <span className="cal-items">
                    {ms.slice(0, 2).map((m) => (
                      <span key={m.id} className="cal-item" dir="auto">
                        <span className="area-dot" style={{ background: areaColor(doc.areas, m.area) }} />
                        {m.ladder ? `▲${m.ladder.level} ` : m.big ? "★ " : ""}
                        {m.title}
                      </span>
                    ))}
                    {ms.length > 2 && <span className="cal-more">+{ms.length - 2}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {selected && (
            <section className="card day-panel">
              <h2 className="card-title">
                {formatFullDate(selected)}
                {releases.get(selected) && <span className="pill current">Released {releases.get(selected)!.name}</span>}
              </h2>
              {dayMoments.map((m) => (
                <button key={m.id} className="echo" onClick={() => setEditing(m)}>
                  {m.photos[0] && <PhotoImg photo={m.photos[0]} alt="" className="echo-thumb" />}
                  <span className="echo-title" dir="auto">
                    {m.big && <span className="star">★ </span>}
                    {m.title}
                  </span>
                  <AreaTag areas={doc.areas} area={m.area} />
                </button>
              ))}
              {dayMoments.length === 0 && <p className="muted">Nothing logged on this day.</p>}
              <QuickAdd key={selected} defaultDate={selected} />
            </section>
          )}
        </>
      ) : (
        <>
          <div className="stat-grid year-stats">
            {[
              ["Moments", String(yearStats.moments)],
              ["Turning points", String(yearStats.big)],
              ["Levels reached", String(yearStats.levels)],
              ["Photos", String(yearStats.photos)],
              ["Made", yearStats.logged ? formatMoney(yearStats.income, doc.currency) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="stat-tile">
                <div className="label">{label}</div>
                <div className="value">{value}</div>
              </div>
            ))}
          </div>
          <div className="year-grid">
            {Array.from({ length: 12 }, (_, i) => {
              const m = `${year}-${String(i + 1).padStart(2, "0")}`;
              const inc = incomeByMonth.get(m);
              return (
                <button
                  key={m}
                  className={`mini-month ${m === monthOf(today) ? "current" : ""}`}
                  onClick={() => {
                    setMonth(m);
                    setMode("month");
                  }}
                >
                  <span className="mini-head">
                    <span>{monthName(i + 1)}</span>
                    <span className="muted">{inc ? compactMoney(inc.amount, doc.currency) : ""}</span>
                  </span>
                  <span className="mini-days">
                    {monthGrid(m).map((cell) => {
                      const ms = cell.inMonth ? (byDate.get(cell.date) ?? []) : [];
                      const top = ms.find((x) => x.big) ?? ms[0];
                      return (
                        <span
                          key={cell.date}
                          className={`mini-day ${cell.inMonth ? "" : "out"} ${top?.big ? "big" : ""} ${cell.date === today ? "today" : ""}`}
                          style={top ? { background: top.big ? undefined : areaColor(doc.areas, top.area) } : undefined}
                        />
                      );
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {editing && <MomentForm key={editing.id} moment={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
