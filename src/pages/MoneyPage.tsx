import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useData } from "../lib/DataContext";
import IncomeChart from "../components/IncomeChart";
import { formatMonth, monthName, monthOf, monthRange, shiftMonth, todayISO } from "../lib/dates";
import { compactMoney, formatMoney, parseAmount, summarizeIncome } from "../lib/money";
import { versionSpans } from "../lib/versions";

type Range = "12" | "24" | "all";

function Tile({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export default function MoneyPage() {
  const { doc, saveIncome, ready } = useData();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const currentMonth = monthOf(today);
  const { currency } = doc;

  const byMonth = useMemo(() => new Map(doc.income.map((i) => [i.month, i])), [doc.income]);

  // Early in a month you're usually recording the one that just ended.
  const defaultMonth = () => {
    const prev = shiftMonth(currentMonth, -1);
    return Number(today.slice(8)) <= 10 && !byMonth.has(prev) ? prev : currentMonth;
  };
  const linked = params.get("month");
  const [month, setMonth] = useState<string>(() =>
    linked && /^\d{4}-\d{2}$/.test(linked) ? linked : defaultMonth(),
  );
  const [range, setRange] = useState<Range>("12");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  const entry = byMonth.get(month);
  useEffect(() => {
    setAmountText(entry ? String(entry.amount) : "");
    setNote(entry?.note ?? "");
    setStatus(null);
  }, [month, entry]);

  function pickMonth(m: string) {
    setMonth(m);
    if (params.has("month")) setParams({}, { replace: true });
  }

  async function save() {
    const amount = parseAmount(amountText);
    if (amount === null) {
      setStatus({ kind: "bad", msg: "That doesn't read as a number." });
      return;
    }
    const ok = await saveIncome(month, { amount, note: note.trim() });
    if (ok) setStatus({ kind: "ok", msg: `Saved ${formatMonth(month)}` });
  }

  const summary = useMemo(() => summarizeIncome(doc.income, currentMonth), [doc.income, currentMonth]);
  const spans = useMemo(() => versionSpans(doc.versions), [doc.versions]);

  const chartMonths = useMemo(() => {
    const end = month > currentMonth ? month : currentMonth;
    if (range === "all") {
      const first = doc.income[0]?.month;
      const from = first && first < shiftMonth(end, -11) ? first : shiftMonth(end, -11);
      return monthRange(from, end);
    }
    return monthRange(shiftMonth(end, -(Number(range) - 1)), end);
  }, [range, doc.income, currentMonth, month]);

  const years = useMemo(() => {
    const set = new Set(doc.income.map((i) => i.month.slice(0, 4)));
    set.add(currentMonth.slice(0, 4));
    return [...set].sort().reverse();
  }, [doc.income, currentMonth]);

  const year = currentMonth.slice(0, 4);
  const delta =
    summary.lastYearSamePeriod !== null && summary.lastYearSamePeriod !== 0
      ? ((summary.thisYear - summary.lastYearSamePeriod) / Math.abs(summary.lastYearSamePeriod)) * 100
      : null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Money</h1>
          <p className="subtitle">One number a month. Skip months freely — a gap is just a gap, not a zero.</p>
        </div>
      </header>

      <section className="panel money-entry">
        <div className="month-stepper">
          <button onClick={() => pickMonth(shiftMonth(month, -1))} aria-label="Previous month">
            ‹
          </button>
          <span className="month-stepper-label">{formatMonth(month)}</span>
          <button onClick={() => pickMonth(shiftMonth(month, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <form
          className="money-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="field amount-field">
            <label htmlFor="amount">Made this month ({currency})</label>
            <input
              id="amount"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="12400 or 12.4k"
            />
          </div>
          <div className="field note-field">
            <label htmlFor="income-note">Note</label>
            <input
              id="income-note"
              dir="auto"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Where it came from (optional)"
            />
          </div>
          <div className="row money-actions">
            <button type="submit" className="primary" disabled={!amountText.trim()}>
              {entry ? "Update" : "Save"}
            </button>
            {entry && (
              <button type="button" className="ghost" onClick={() => saveIncome(month, null)}>
                Clear month
              </button>
            )}
            {status && <span className={status.kind === "ok" ? "success-text" : "error-text"}>{status.msg}</span>}
          </div>
        </form>
      </section>

      <div className="stat-grid">
        <Tile
          label={`${year} so far`}
          value={formatMoney(summary.thisYear, currency)}
          sub={
            delta !== null ? (
              <>
                <span className={delta >= 0 ? "up" : "down"}>{delta >= 0 ? "▲" : "▼"}</span>{" "}
                {Math.abs(delta).toFixed(0)}% vs same months {Number(year) - 1}
              </>
            ) : (
              "Jan to now"
            )
          }
        />
        <Tile
          label="Monthly average"
          value={summary.avg12 !== null ? formatMoney(summary.avg12, currency) : "—"}
          sub={`last 12 months · ${summary.logged12} logged`}
        />
        <Tile
          label="Best month"
          value={summary.best ? formatMoney(summary.best.amount, currency) : "—"}
          sub={summary.best ? formatMonth(summary.best.month) : undefined}
        />
        <Tile
          label="All time"
          value={formatMoney(summary.allTime, currency)}
          sub={`${doc.income.length} month${doc.income.length === 1 ? "" : "s"} logged`}
        />
      </div>

      <section className="panel">
        <h2>
          By month
          <span className="segmented" role="group" aria-label="Range">
            {(["12", "24", "all"] as Range[]).map((r) => (
              <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>
                {r === "all" ? "All" : `${r}M`}
              </button>
            ))}
          </span>
        </h2>
        {ready && doc.income.length === 0 ? (
          <div className="empty compact">Log a month above and the chart starts here.</div>
        ) : (
          <IncomeChart
            months={chartMonths}
            income={doc.income}
            spans={spans}
            currency={currency}
            selected={month}
            onSelect={pickMonth}
          />
        )}
      </section>

      <section className="panel">
        <h2>Every month</h2>
        <div className="table-scroll">
          <table className="year-table">
            <thead>
              <tr>
                <th>Year</th>
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i}>{monthName(i + 1, true)}</th>
                ))}
                <th className="total">Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const rows = doc.income.filter((i) => i.month.startsWith(y));
                return (
                  <tr key={y}>
                    <th>{y}</th>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = `${y}-${String(i + 1).padStart(2, "0")}`;
                      const e = byMonth.get(m);
                      return (
                        <td key={m}>
                          <button
                            className={m === month ? "cell sel" : "cell"}
                            onClick={() => {
                              pickMonth(m);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            title={e ? `${formatMonth(m)}: ${formatMoney(e.amount, currency)}${e.note ? ` — ${e.note}` : ""}` : `Log ${formatMonth(m)}`}
                          >
                            {e ? compactMoney(e.amount, currency) : <span className="dim">·</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="total">
                      {rows.length ? formatMoney(rows.reduce((s, i) => s + i.amount, 0), currency) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
