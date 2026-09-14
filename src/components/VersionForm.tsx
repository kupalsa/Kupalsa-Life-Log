import { useState } from "react";
import { useData } from "../lib/DataContext";
import type { Version } from "../lib/types";
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
  const { saveVersion, deleteVersion } = useData();
  const [draft, setDraft] = useState<Version>(version);
  const [confirming, setConfirming] = useState(false);

  function set<K extends keyof Version>(key: K, value: Version[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
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
          saveVersion({
            ...draft,
            name: draft.name.trim(),
            headline: draft.headline.trim(),
            note: draft.note.trim(),
          });
          onClose();
        }}
        role="dialog"
        aria-modal="true"
      >
        <h2>{isNew ? "New version" : `Edit ${version.name}`}</h2>
        <div className="row">
          <div className="field" style={{ width: 110 }}>
            <label htmlFor="v-name">Name</label>
            <input id="v-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="v7" autoFocus={isNew} />
          </div>
          <div className="field">
            <label htmlFor="v-start">Started</label>
            <input
              id="v-start"
              type="date"
              value={draft.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="v-headline">In one line — who are you in this version?</label>
          <input
            id="v-headline"
            dir="auto"
            value={draft.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="e.g. Trading full-time, living on my own"
          />
        </div>
        <div className="field">
          <label htmlFor="v-note">What changed from the last version</label>
          <textarea
            id="v-note"
            dir="auto"
            rows={5}
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="What you let go of, what you took on, what you now believe"
          />
        </div>
        <p className="small-note">
          A version runs until the next one starts. Moments and income fall into whichever
          version was active at the time.
        </p>
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
            Save
          </button>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${version.name}?`}
          message="Only the chapter marker goes. Its moments and income stay, and fold into the version before it."
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
