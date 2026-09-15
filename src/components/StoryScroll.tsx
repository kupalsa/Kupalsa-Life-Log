import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { areaColor } from "../lib/areas";
import { daysBetween, formatFullDate, gapLabel, weekday } from "../lib/dates";
import { spanAt, versionSpans, type VersionSpan } from "../lib/versions";
import type { Moment, Photo } from "../lib/types";
import { AreaTag } from "./Area";
import { PhotoImg } from "./Photos";
import Lightbox from "./Lightbox";

type Block =
  | { kind: "chapter"; key: string; span: VersionSpan | null }
  | { kind: "entry"; key: string; moment: Moment; next: Moment | null; yearStart: string | null };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
}

/**
 * The visual story: newest at the top, the first thing ever logged at the
 * bottom. Each entry hands over to the one before it with a round arrow and
 * the time that passed between them; version releases appear as chapter cards.
 */
export default function StoryScroll({ moments, onEdit }: { moments: Moment[]; onEdit: (m: Moment) => void }) {
  const { doc } = useData();
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; start: number; caption: string } | null>(null);
  const spans = useMemo(() => versionSpans(doc.versions), [doc.versions]);

  const blocks = useMemo(() => {
    const out: Block[] = [];
    let lastVersion: string | undefined;
    let lastYear: string | undefined;
    moments.forEach((m, i) => {
      const span = spanAt(spans, m.date);
      const vKey = span?.version.id ?? "before";
      if (spans.length && vKey !== lastVersion) out.push({ kind: "chapter", key: `c-${vKey}`, span });
      const year = m.date.slice(0, 4);
      out.push({ kind: "entry", key: m.id, moment: m, next: moments[i + 1] ?? null, yearStart: year !== lastYear ? year : null });
      lastVersion = vKey;
      lastYear = year;
    });
    return out;
  }, [moments, spans]);

  const years = useMemo(() => [...new Set(moments.map((m) => m.date.slice(0, 4)))], [moments]);

  const first = moments[moments.length - 1];

  return (
    <div className="story">
      {years.length > 1 && (
        <nav className="year-rail" aria-label="Jump to year">
          {years.map((y) => (
            <button key={y} onClick={() => goTo(`year-${y}`)}>
              {y}
            </button>
          ))}
        </nav>
      )}

      <div className="story-column">
        {blocks.map((b) => {
          if (b.kind === "chapter") {
            const s = b.span;
            return (
              <section key={b.key} className="story-chapter reveal">
                {s ? (
                  <>
                    <span className="chapter-eyebrow">Version</span>
                    <span className="chapter-name">{s.version.name}</span>
                    {s.version.headline && (
                      <span className="chapter-codename" dir="auto">
                        {s.version.headline}
                      </span>
                    )}
                    <span className="chapter-range">
                      {formatFullDate(s.start)} — {s.end ? formatFullDate(s.end) : "now"}
                    </span>
                  </>
                ) : (
                  <span className="chapter-codename">Before {spans[0].version.name}</span>
                )}
              </section>
            );
          }

          const m = b.moment;
          const span = spanAt(spans, m.date);
          const [hero, ...rest] = m.photos;
          const open = (start: number) => setLightbox({ photos: m.photos, start, caption: m.title });
          return (
            <div key={b.key}>
              <article
                id={`story-${m.id}`}
                className={`story-entry reveal ${m.big ? "big" : ""} ${hero ? "has-photo" : "no-photo"}`}
                style={{ ["--area" as string]: areaColor(doc.areas, m.area) }}
              >
                {b.yearStart && <span id={`year-${b.yearStart}`} className="year-anchor" />}
                <div className="story-meta">
                  <time dateTime={m.date}>{formatFullDate(m.date)}</time>
                  <span className="muted">{weekday(m.date)}</span>
                  {span && <span className="story-version">{span.version.name}</span>}
                  <span className="spacer" />
                  <AreaTag areas={doc.areas} area={m.area} />
                </div>

                {hero && (
                  <button className="story-hero-photo" onClick={() => open(0)} aria-label="Open photo">
                    <PhotoImg photo={hero} alt={m.title} />
                  </button>
                )}
                {rest.length > 0 && (
                  <div className={`story-photo-grid n${Math.min(rest.length, 3)}`}>
                    {rest.slice(0, 3).map((p, i) => (
                      <button key={p.path} onClick={() => open(i + 1)} aria-label="Open photo">
                        <PhotoImg photo={p} alt="" />
                        {i === 2 && rest.length > 3 && <span className="more-photos">+{rest.length - 3}</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="story-text">
                  {(m.big || m.ladder) && (
                    <div className="story-badges">
                      {m.ladder && <span className="level-badge big">▲ {m.ladder.level}</span>}
                      {m.big && <span className="turning-badge">★ Turning point</span>}
                    </div>
                  )}
                  <h2 className="story-title" dir="auto">
                    {m.title}
                  </h2>
                  {m.note && (
                    <p className="story-note" dir="auto">
                      {m.note}
                    </p>
                  )}
                  <button className="ghost small story-edit" onClick={() => onEdit(m)}>
                    Edit
                  </button>
                </div>
              </article>

              {b.next && (
                <div className="story-link">
                  <span className="story-line" />
                  <button
                    className="story-arrow"
                    onClick={() => goTo(`story-${b.next!.id}`)}
                    aria-label={`Previous moment: ${b.next.title}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5v14M6 13l6 6 6-6" />
                    </svg>
                  </button>
                  <span className="story-gap">{gapLabel(daysBetween(b.next.date, m.date))}</span>
                  <span className="story-line" />
                </div>
              )}
            </div>
          );
        })}

        {first && (
          <div className="story-origin reveal">
            <span className="origin-dot" />
            <span className="origin-label">The beginning</span>
            <span className="muted">{formatFullDate(first.date)}</span>
          </div>
        )}
      </div>

      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
