import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import MomentForm from "../components/MomentForm";
import MomentList from "../components/MomentList";
import StoryScroll from "../components/StoryScroll";
import { AreaPicker } from "../components/Area";
import type { Moment } from "../lib/types";

type Mode = "story" | "list";
const MODE_KEY = "life-log-story-mode";

function loadMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "list" ? "list" : "story";
  } catch {
    return "story";
  }
}

export default function StoryPage() {
  const { doc, ready } = useData();
  const [mode, setModeState] = useState<Mode>(loadMode);
  const [editing, setEditing] = useState<Moment | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [bigOnly, setBigOnly] = useState(false);
  const [query, setQuery] = useState("");

  function setMode(m: Mode) {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // Remembering the view is a convenience only.
    }
  }

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

  const firstYear = doc.moments.at(-1)?.date.slice(0, 4);
  const photoCount = doc.moments.reduce((n, m) => n + m.photos.length, 0);

  return (
    <div className={`page story-page mode-${mode}`}>
      <header className="story-header">
        <p className="eyebrow">Your story</p>
        <h1 className="display">
          {doc.moments.length ? (
            <>
              {doc.moments.length} moment{doc.moments.length === 1 ? "" : "s"}
              <span className="display-soft">, {firstYear} to now</span>
            </>
          ) : (
            "It starts with one moment"
          )}
        </h1>
        {doc.moments.length > 0 && (
          <p className="subtitle">
            Scroll down to go back in time. {photoCount} photo{photoCount === 1 ? "" : "s"} along the way.
          </p>
        )}

        {doc.moments.length > 0 && (
          <div className="story-toolbar">
            <div className="segmented" role="group" aria-label="View">
              <button className={mode === "story" ? "on" : ""} onClick={() => setMode("story")}>
                Story
              </button>
              <button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}>
                List
              </button>
            </div>
            <button className={bigOnly ? "toggle on" : "toggle"} aria-pressed={bigOnly} onClick={() => setBigOnly(!bigOnly)}>
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
            <AreaPicker areas={usedAreas} palette={doc.areas} value={areaFilter} onChange={setAreaFilter} allowAll />
          </div>
        )}
      </header>

      {!ready && <div className="empty">Loading your story…</div>}

      {ready && doc.moments.length === 0 && (
        <div className="empty">
          <p>
            Log something on the <Link to="/">Now</Link> page — with a photo if you have one — and it
            becomes the first page of this story.
          </p>
        </div>
      )}

      {doc.moments.length > 0 && filtered.length === 0 && <div className="empty">No moments match.</div>}

      {filtered.length > 0 &&
        (mode === "story" ? <StoryScroll moments={filtered} onEdit={setEditing} /> : <MomentList moments={filtered} onEdit={setEditing} />)}

      {editing && <MomentForm key={editing.id} moment={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
