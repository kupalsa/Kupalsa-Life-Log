import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { addDays, daysBetween, formatFullDate, formatMonth, monthOf, todayISO } from "../lib/dates";
import { ladderProgress, stepLabel, type LadderProgress } from "../lib/ladders";
import { newId, type Ladder, type Moment } from "../lib/types";
import QuickAdd from "../components/QuickAdd";
import MomentForm from "../components/MomentForm";
import ConfirmDialog from "../components/ConfirmDialog";

function LadderForm({ ladder, isNew, onClose }: { ladder: Ladder; isNew: boolean; onClose: () => void }) {
  const { doc, saveLadder, deleteLadder } = useData();
  const [name, setName] = useState(ladder.name);
  const [levels, setLevels] = useState(ladder.levels.join(", "));
  const [area, setArea] = useState(ladder.area || doc.areas[0] || "");
  const [confirming, setConfirming] = useState(false);
  const parsed = levels.split(/[,\n]/).map((l) => l.trim()).filter(Boolean);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || parsed.length < 2) return;
          saveLadder({ ...ladder, name: name.trim(), levels: parsed, area });
          onClose();
        }}
      >
        <h2>{isNew ? "New ladder" : `Edit ${ladder.name}`}</h2>
        <div className="row">
          <div className="field grow">
            <label htmlFor="l-name">Name</label>
            <input id="l-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Running distance" autoFocus={isNew} />
          </div>
          <div className="field">
            <label htmlFor="l-area">Area</label>
            <select id="l-area" value={area} onChange={(e) => setArea(e.target.value)}>
              {doc.areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="l-levels">Levels, lowest first</label>
          <textarea id="l-levels" rows={3} value={levels} onChange={(e) => setLevels(e.target.value)} placeholder="5k, 10k, Half marathon, Marathon" />
        </div>
        <p className="small-note">{parsed.length} levels. Separate with commas or new lines.</p>
        <div className="row modal-actions">
          {!isNew && (
            <button type="button" className="danger ghost-danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!name.trim() || parsed.length < 2}>
            Save
          </button>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${ladder.name}?`}
          message="The ladder goes; the moments where you reached its levels stay in your story."
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            deleteLadder(ladder.id);
            onClose();
          }}
        />
      )}
    </div>
  );
}

function LadderCard({ p, onEdit, onOpen }: { p: LadderProgress; onEdit: () => void; onOpen: (m: Moment) => void }) {
  const today = todayISO();
  const [logging, setLogging] = useState(false);
  const reached = p.rungs.filter((r) => r.moment);

  // Show the climb around where you are: a rung below your first send up to two above your top.
  const lo = Math.max(0, (reached[0]?.index ?? 0) - 1);
  const hi = Math.min(p.rungs.length - 1, Math.max((p.top?.index ?? 0) + 2, lo + 5));
  const visible = p.rungs.slice(lo, hi + 1);

  const steps = reached.map((r) => r.daysFromPrevious).filter((d): d is number => d !== null);
  const pace = steps.length ? steps.reduce((a, b) => a + b, 0) / steps.length : null;
  const projected = pace && p.top?.moment && p.next ? addDays(p.top.moment.date, Math.round(pace)) : null;

  return (
    <section className="card ladder-card">
      <div className="ladder-head">
        <div>
          <h2 className="ladder-name">{p.ladder.name}</h2>
          <div className="muted">
            {p.top?.moment
              ? `At ${p.top.level} for ${stepLabel(daysBetween(p.top.moment.date, today))}`
              : "No level logged yet — log your current one to start the climb."}
          </div>
        </div>
        <div className="ladder-top">
          <span className="ladder-top-level">{p.top?.level ?? "—"}</span>
          {p.next && <span className="ladder-next">next · {p.next}</span>}
        </div>
      </div>

      <div className="staircase-scroll">
        <div className="staircase">
          {visible.map((r, i) => {
            const h = 34 + i * 26;
            return (
              <div key={r.level} className={`stair ${r.moment ? "reached" : ""} ${r === p.top ? "top" : ""} ${r.level === p.next ? "next" : ""}`}>
                {r.daysFromPrevious !== null && <span className="stair-gap">{stepLabel(r.daysFromPrevious)}</span>}
                <button
                  className="stair-block"
                  style={{ height: h }}
                  onClick={() => r.moment && onOpen(r.moment)}
                  disabled={!r.moment}
                  aria-label={r.moment ? `${r.level}, reached ${formatFullDate(r.moment.date)}` : `${r.level}, not yet`}
                >
                  <span className="stair-level">{r.level}</span>
                </button>
                <span className="stair-date">{r.moment ? formatMonth(monthOf(r.moment.date), true) : ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      {projected && (
        <p className="pace-note">
          Your average step takes <b>{stepLabel(Math.round(pace!))}</b>. At that pace, {p.next} lands around{" "}
          <b>{formatMonth(monthOf(projected))}</b>.
        </p>
      )}

      {logging ? (
        <QuickAdd presetLadder={{ ladderId: p.ladder.id, level: p.next ?? p.ladder.levels[p.ladder.levels.length - 1] }} onDone={() => setLogging(false)} />
      ) : (
        <div className="row">
          <button className="primary" onClick={() => setLogging(true)}>
            ▲ Log a level
          </button>
          <button className="ghost" onClick={onEdit}>
            Edit ladder
          </button>
        </div>
      )}

      {reached.length > 0 && (
        <ol className="sends">
          {[...reached].reverse().map((r) => (
            <li key={r.level}>
              <button onClick={() => onOpen(r.moment!)}>
                <span className="level-badge big">{r.level}</span>
                <span className="send-title" dir="auto">
                  {r.moment!.title}
                </span>
                <span className="muted">{formatFullDate(r.moment!.date)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function LaddersPage() {
  const { doc } = useData();
  const [editing, setEditing] = useState<{ ladder: Ladder; isNew: boolean } | null>(null);
  const [opened, setOpened] = useState<Moment | null>(null);
  const progress = useMemo(() => doc.ladders.map((l) => ladderProgress(l, doc.moments)), [doc.ladders, doc.moments]);

  return (
    <div className="page ladders-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Progress</p>
          <h1 className="display">Ladders</h1>
          <p className="subtitle">Levels you climb over years. Log only the first time you reach each one.</p>
        </div>
        <button
          onClick={() =>
            setEditing({ ladder: { id: newId(), name: "", levels: [], area: doc.areas[0] ?? "", createdAt: new Date().toISOString() }, isNew: true })
          }
        >
          + New ladder
        </button>
      </header>

      {progress.map((p) => (
        <LadderCard key={p.ladder.id} p={p} onEdit={() => setEditing({ ladder: p.ladder, isNew: false })} onOpen={setOpened} />
      ))}

      {progress.length === 0 && <div className="empty">No ladders. Add one for any skill with levels.</div>}

      {editing && <LadderForm key={editing.ladder.id} {...editing} onClose={() => setEditing(null)} />}
      {opened && <MomentForm key={opened.id} moment={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
