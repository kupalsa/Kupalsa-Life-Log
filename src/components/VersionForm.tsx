import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { carryOverNotes } from "../lib/versions";
import { noteLines, type ReleaseNotes, type Version } from "../lib/types";
import { NOTE_SECTIONS } from "../lib/releaseNotes";
import ConfirmDialog from "./ConfirmDialog";

export default function VersionForm({
  version,
  isNew,
  onClose,
}: {
  version: Version;
  isNew: boolean;
  onClose: () => void;
}) {
  const { doc, saveVersion, deleteVersion } = useData();
  const [draft, setDraft] = useState<Version>(version);
  const [confirming, setConfirming] = useState(false);

  // For a new release, the previous version's known issues become a checklist.
  const previous = useMemo(
    () =>
      isNew
        ? [...doc.versions].filter((v) => v.startDate <= draft.startDate && v.id !== version.id).sort((a, b) => a.startDate.localeCompare(b.startDate)).at(-1)
        : undefined,
    [isNew, doc.versions, draft.startDate, version.id],
  );
  const inherited = previous ? noteLines(previous.notes.known) : [];
  const [fixed, setFixed] = useState<Set<string>>(new Set());
  const [carried, setCarried] = useState(false);

  function set<K extends keyof Version>(key: K, value: Version[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setNote(key: keyof ReleaseNotes, value: string) {
    setDraft((d) => ({ ...d, notes: { ...d.notes, [key]: value } }));
  }

  function toggleFixed(item: string) {
    const next = new Set(fixed);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setFixed(next);
  }

  function applyCarryOver() {
    const { fixed: f, known } = carryOverNotes(previous, fixed);
    setDraft((d) => ({
      ...d,
      notes: {
        ...d.notes,
        fixed: [f, d.notes.fixed].filter(Boolean).join("\n"),
        known: [known, d.notes.known].filter(Boolean).join("\n"),
      },
    }));
    setCarried(true);
  }

  const valid = draft.name.trim() !== "" && draft.startDate !== "";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          saveVersion({ ...draft, name: draft.name.trim(), headline: draft.headline.trim(), note: draft.note.trim() });
          onClose();
        }}
        role="dialog"
        aria-modal="true"
      >
        <h2>{isNew ? "Release a new version of you" : `Edit ${version.name}`}</h2>
        <div className="row">
          <div className="field" style={{ width: 120 }}>
            <label htmlFor="v-name">Version</label>
            <input id="v-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="2.0" autoFocus={isNew} />
          </div>
          <div className="field">
            <label htmlFor="v-start">Released</label>
            <input id="v-start" type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="field grow">
            <label htmlFor="v-headline">Codename</label>
            <input id="v-headline" dir="auto" value={draft.headline} onChange={(e) => set("headline", e.target.value)} placeholder="e.g. The Disciplined One" />
          </div>
        </div>

        {inherited.length > 0 && !carried && (
          <div className="carry-over">
            <div className="carry-title">
              Known issues in {previous!.name} — tick the ones this version fixed
            </div>
            {inherited.map((item) => (
              <label key={item} className="check">
                <input type="checkbox" checked={fixed.has(item)} onChange={() => toggleFixed(item)} />
                <span dir="auto">{item}</span>
              </label>
            ))}
            <button type="button" className="small" onClick={applyCarryOver}>
              Carry into release notes
            </button>
          </div>
        )}

        <div className="notes-grid">
          {NOTE_SECTIONS.map((s) => (
            <div key={s.key} className={`field note-section note-${s.key}`}>
              <label htmlFor={`v-${s.key}`}>
                <span className="note-mark">{s.mark}</span> {s.label}
              </label>
              <textarea
                id={`v-${s.key}`}
                dir="auto"
                rows={3}
                value={draft.notes[s.key]}
                onChange={(e) => setNote(s.key, e.target.value)}
                placeholder={s.hint}
              />
            </div>
          ))}
        </div>

        <div className="field">
          <label htmlFor="v-note">Release story</label>
          <textarea
            id="v-note"
            dir="auto"
            rows={3}
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="What made you call it a new version"
          />
        </div>
        <p className="small-note">One item per line. A version runs until the next release.</p>
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
          <button type="submit" className="primary" disabled={!valid}>
            {isNew ? "Release" : "Save"}
          </button>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${version.name}?`}
          message="Only the release marker goes. Its moments and income stay, and fold into the version before it."
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            deleteVersion(version.id);
            onClose();
          }}
        />
      )}
    </div>
  );
}
