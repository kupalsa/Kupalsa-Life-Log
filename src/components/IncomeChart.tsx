import { useEffect, useMemo, useRef, useState } from "react";
import { formatMonth, shiftMonth } from "../lib/dates";
import { compactMoney, formatMoney, niceTicks } from "../lib/money";
import { spanForMonth, type VersionSpan } from "../lib/versions";
import type { IncomeMonth } from "../lib/types";

interface Props {
  months: string[];
  income: IncomeMonth[];
  spans: VersionSpan[];
  currency: string;
  selected: string;
  onSelect: (month: string) => void;
}

const H = 250;
const PAD = { top: 26, right: 8, bottom: 26, left: 52 };

/** Column path: 4px rounded at the value end, square on the baseline. */
function columnPath(x: number, base: number, end: number, w: number): string {
  const h = Math.abs(end - base);
  const r = Math.min(4, h, w / 2);
  const dir = end < base ? 1 : -1; // 1 = grows upward
  return (
    `M${x},${base} V${end + dir * r} Q${x},${end} ${x + r},${end} ` +
    `H${x + w - r} Q${x + w},${end} ${x + w},${end + dir * r} V${base} Z`
  );
}

export default function IncomeChart({ months, income, spans, currency, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byMonth = useMemo(() => new Map(income.map((i) => [i.month, i])), [income]);
  const values = months.map((m) => byMonth.get(m)?.amount ?? null);
  const logged = values.filter((v): v is number => v !== null);

  const ticks = logged.length ? niceTicks(Math.min(...logged), Math.max(...logged)) : [0, 1000];
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1] === yMin ? yMin + 1 : ticks[ticks.length - 1];

  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / months.length;
  const barW = Math.max(2, Math.min(24, band - 2, band * 0.7));
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * plotH;
  const base = y(0);
  const labelEvery = Math.max(1, Math.ceil(46 / band));

  // Where one version hands over to the next.
  const markers = months.flatMap((m, i) => {
    const cur = spanForMonth(spans, m)?.version;
    const prev = spanForMonth(spans, i === 0 ? shiftMonth(m, -1) : months[i - 1])?.version;
    if (!cur) return [];
    if (i === 0) return [{ i, name: cur.name, line: cur.id !== prev?.id }];
    return cur.id !== prev?.id ? [{ i, name: cur.name, line: true }] : [];
  });

  const lastLogged = values.findLastIndex((v) => v !== null);
  const hovered = hover !== null ? months[hover] : null;
  const hoveredEntry = hovered ? byMonth.get(hovered) : undefined;
  const hoveredVersion = hovered ? spanForMonth(spans, hovered)?.version : undefined;
  const tipX = hover !== null ? Math.min(Math.max(PAD.left + (hover + 0.5) * band, 80), width - 80) : 0;

  return (
    <div className="chart-wrap" ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Monthly income, ${formatMonth(months[0])} to ${formatMonth(months[months.length - 1])}. The table below lists every value.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? "axis-line" : "grid-line"}
            />
            <text x={PAD.left - 8} y={y(t) + 3} className="tick" textAnchor="end">
              {compactMoney(t, currency)}
            </text>
          </g>
        ))}

        {months.map((m, i) => {
          const v = values[i];
          const x = PAD.left + i * band;
          const cx = x + (band - barW) / 2;
          const isSel = m === selected;
          return (
            <g key={m}>
              {(isSel || hover === i) && (
                <rect x={x} y={PAD.top} width={band} height={plotH} className={isSel ? "band sel" : "band"} />
              )}
              {v === null ? (
                <rect x={cx} y={base - 1} width={barW} height={2} className="missing" />
              ) : (
                v !== 0 && (
                  <path d={columnPath(cx, base, y(v), barW)} className={v < 0 ? "bar neg" : "bar"} />
                )
              )}
              {(months.length - 1 - i) % labelEvery === 0 && (
                <text x={x + band / 2} y={H - 8} className="tick" textAnchor="middle">
                  {formatMonth(m, true)}
                </text>
              )}
            </g>
          );
        })}

        {markers.map(({ i, name, line }) => {
          const x = PAD.left + i * band;
          return (
            <g key={`${name}-${i}`}>
              {line && <line x1={x} x2={x} y1={PAD.top - 8} y2={PAD.top + plotH} className="version-line" />}
              <text x={x + 5} y={PAD.top - 12} className="version-label">
                {name}
              </text>
            </g>
          );
        })}

        {lastLogged >= 0 && hover === null && values[lastLogged] !== null && (
          <text
            x={PAD.left + (lastLogged + 0.5) * band}
            y={values[lastLogged]! >= 0 ? y(values[lastLogged]!) - 6 : y(values[lastLogged]!) + 13}
            className="cap-label"
            textAnchor={lastLogged === months.length - 1 ? "end" : "middle"}
          >
            {compactMoney(values[lastLogged]!, currency)}
          </text>
        )}

        {months.map((m, i) => (
          <rect
            key={`hit-${m}`}
            x={PAD.left + i * band}
            y={0}
            width={band}
            height={H}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onClick={() => {
              setHover(i);
              onSelect(m);
            }}
          />
        ))}
      </svg>

      {hovered && (
        <div className="chart-tip" style={{ left: tipX }}>
          <div className="tip-month">
            {formatMonth(hovered)}
            {hoveredVersion && <span className="tip-version">{hoveredVersion.name}</span>}
          </div>
          <div className="tip-value">
            {hoveredEntry ? formatMoney(hoveredEntry.amount, currency) : <span className="muted">Not logged</span>}
          </div>
          {hoveredEntry?.note && <div className="tip-note">{hoveredEntry.note}</div>}
        </div>
      )}
    </div>
  );
}
