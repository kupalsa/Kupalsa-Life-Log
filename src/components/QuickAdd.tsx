import { useState, type FormEvent } from "react";
import { useData } from "../lib/DataContext";
import { formatFullDate, todayISO } from "../lib/dates";
import { newId } from "../lib/types";
import { AreaPicker } from "./Area";

/**
 * The whole point of the app is that logging is light: one line, Enter, done.
 * Date defaults to today, the note is optional and hidden until asked for.
 */
export default function QuickAdd() {
  const { doc, saveMoment } = useData();
  const [title, setTitle] = useState("");
  // null = "today", resolved at save time so a tab left open overnight is right.
  const [date, setDate] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const chosenArea = area && doc.areas.includes(area) ? area : (doc.areas[0] ?? "Other");
  const shownDate = date ?? todayISO();

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const draft = { title, note, big, showNote };
    const when = date ?? todayISO();

    // Clear straight away — the moment is already on screen. Put the text back
    // if storing it fails, so nothing written is lost.
    setTitle("");
    setNote("");
    setBig(false);
    setShowNote(false);
    setFlash(null);

    const ok = await saveMoment({
      id: newId(),
      date: when,
      title: clean,
      note: note.trim(),
      area: chosenArea,
      big,
      createdAt: new Date().toISOString(),
    });

    if (ok) {
      setFlash(`Logged for ${formatFullDate(when)}`);
      setDate(null);
      window.setTimeout(() => setFlash(null), 2600);
    } else {
      setTitle(draft.title);
      setNote(draft.note);
      setBig(draft.big);
      setShowNote(draft.showNote);
    }
  }

  return (
    <form className="panel quick-add" onSubmit={submit}>
      <input
        className="quick-title"
        dir="auto"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          // Explicit rather than relying on implicit form submission, which
          // some mobile keyboards and IMEs don't trigger. Skip while composing
          // (e.g. confirming a candidate in a Russian/Hebrew/CJK IME).
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="What happened that you want to remember?"
        aria-label="What happened"
        enterKeyHint="done"
      />

      {showNote && (
        <textarea
          dir="auto"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="A few words on why it matters (optional)"
          rows={3}
          autoFocus
        />
      )}

      <AreaPicker areas={doc.areas} value={chosenArea} onChange={(a) => a && setArea(a)} />

      <div className="quick-row">
        <input
          type="date"
          value={shownDate}
          max="2100-12-31"
          onChange={(e) => setDate(e.target.value || null)}
          aria-label="Date"
        />
        <button
          type="button"
          className={big ? "toggle on" : "toggle"}
          aria-pressed={big}
          onClick={() => setBig(!big)}
          title="Mark as a turning point"
        >
          {big ? "★" : "☆"} Turning point
        </button>
        {!showNote && (
          <button type="button" className="ghost" onClick={() => setShowNote(true)}>
            + Note
          </button>
        )}
        <span className="spacer" />
        {flash && <span className="success-text">{flash}</span>}
        <button type="submit" className="primary" disabled={!title.trim()}>
          Log it
        </button>
      </div>
    </form>
  );
}
