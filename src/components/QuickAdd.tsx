import { useState, type FormEvent } from "react";
import { useData } from "../lib/DataContext";
import { formatFullDate, todayISO } from "../lib/dates";
import { preparePhoto, type PreparedPhoto } from "../lib/photos";
import { newId, type Moment } from "../lib/types";
import { AreaPicker } from "./Area";
import { PhotoPicker } from "./Photos";
import LadderFields from "./LadderFields";

/**
 * The whole point of the app is that logging is light: one line, Enter, done.
 * Everything else — note, photo, level-up, turning point — is one tap away and optional.
 */
export default function QuickAdd({
  defaultDate,
  presetLadder,
  onDone,
}: {
  defaultDate?: string;
  presetLadder?: Moment["ladder"];
  onDone?: () => void;
}) {
  const { doc, saveMoment } = useData();
  const [title, setTitle] = useState("");
  // null = "today", resolved at save time so a tab left open overnight is right.
  const [date, setDate] = useState<string | null>(defaultDate ?? null);
  const [area, setArea] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [ladder, setLadder] = useState<Moment["ladder"]>(presetLadder ?? null);
  const [showLadder, setShowLadder] = useState(Boolean(presetLadder));
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const when = date ?? todayISO();
  const ladderDef = doc.ladders.find((l) => l.id === ladder?.ladderId);
  const chosenArea =
    area && doc.areas.includes(area)
      ? area
      : ladderDef?.area && doc.areas.includes(ladderDef.area)
        ? ladderDef.area
        : (doc.areas[0] ?? "Other");
  const autoTitle = ladderDef && ladder ? `Sent my first ${ladder.level}` : "";

  async function addFiles(files: File[]) {
    setPreparing(true);
    try {
      const prepared = await Promise.all(files.map((f) => preparePhoto(f, when)));
      setPhotos((p) => [...p, ...prepared]);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setPreparing(false);
    }
  }

  function reset() {
    setTitle("");
    setNote("");
    setBig(false);
    setShowNote(false);
    setLadder(null);
    setShowLadder(false);
    setPhotos([]);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const clean = title.trim() || autoTitle;
    if (!clean || preparing) return;
    const draft = { title, note, big, showNote, ladder, showLadder, photos };

    // Clear straight away. Put everything back if storing fails, so nothing written is lost.
    reset();
    setFlash(photos.length ? { ok: true, msg: "Uploading…" } : null);

    const ok = await saveMoment(
      {
        id: newId(),
        date: when,
        title: clean,
        note: note.trim(),
        area: chosenArea,
        big: big || ladder !== null,
        photos: [],
        ladder,
        createdAt: new Date().toISOString(),
      },
      photos,
    );

    if (ok) {
      setFlash({ ok: true, msg: `Logged for ${formatFullDate(when)}` });
      setDate(defaultDate ?? null);
      window.setTimeout(() => setFlash(null), 2600);
      onDone?.();
    } else {
      setFlash(null);
      setTitle(draft.title);
      setNote(draft.note);
      setBig(draft.big);
      setShowNote(draft.showNote);
      setLadder(draft.ladder);
      setShowLadder(draft.showLadder);
      setPhotos(draft.photos);
    }
  }

  return (
    <form className="card quick-add" onSubmit={submit}>
      <input
        className="quick-title"
        dir="auto"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          // Explicit rather than implicit form submission, which some mobile
          // keyboards skip. Not while an IME is composing a word.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={autoTitle || "What happened that you want to remember?"}
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
          placeholder="Why it matters, what it felt like (optional)"
          rows={3}
          autoFocus
        />
      )}

      {(photos.length > 0 || preparing) && (
        <PhotoPicker
          pending={photos}
          onFiles={addFiles}
          onRemovePending={(i) => setPhotos((p) => p.filter((_, j) => j !== i))}
          busy={preparing}
        />
      )}

      {showLadder && (
        <div className="quick-ladder">
          <span className="muted">Level up on</span>
          <LadderFields ladders={doc.ladders} moments={doc.moments} value={ladder} onChange={setLadder} />
        </div>
      )}

      <AreaPicker areas={doc.areas} value={chosenArea} onChange={(a) => a && setArea(a)} />

      <div className="quick-row">
        <input type="date" value={when} max="2100-12-31" onChange={(e) => setDate(e.target.value || null)} aria-label="Date" />
        <button
          type="button"
          className={big || ladder ? "toggle on" : "toggle"}
          aria-pressed={big}
          onClick={() => setBig(!big)}
          title="Mark as a turning point"
        >
          {big || ladder ? "★" : "☆"} <span className="hide-sm">Turning point</span>
        </button>
        {photos.length === 0 && !preparing && (
          <PhotoPicker pending={[]} onFiles={addFiles} onRemovePending={() => undefined} compact />
        )}
        {!showLadder && doc.ladders.length > 0 && (
          <button type="button" className="ghost" onClick={() => setShowLadder(true)}>
            ▲ <span className="hide-sm">Level up</span>
          </button>
        )}
        {!showNote && (
          <button type="button" className="ghost" onClick={() => setShowNote(true)}>
            + Note
          </button>
        )}
        <span className="spacer" />
        {flash && <span className={flash.ok ? "success-text" : "error-text"}>{flash.msg}</span>}
        <button type="submit" className="primary" disabled={!(title.trim() || autoTitle) || preparing}>
          Log it
        </button>
      </div>
    </form>
  );
}
