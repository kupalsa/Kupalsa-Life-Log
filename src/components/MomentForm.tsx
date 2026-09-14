import { useState } from "react";
import { useData } from "../lib/DataContext";
import type { Moment } from "../lib/types";
import { AreaPicker } from "./Area";
import ConfirmDialog from "./ConfirmDialog";

export default function MomentForm({ moment, onClose }: { moment: Moment; onClose: () => void }) {
  const { doc, saveMoment, deleteMoment } = useData();
  const [draft, setDraft] = useState<Moment>(moment);
  const [confirming, setConfirming] = useState(false);

  // An area that was since removed from the list still shows as selectable.
  const areas = doc.areas.includes(draft.area) ? doc.areas : [...doc.areas, draft.area];

  function set<K extends keyof Moment>(key: K, value: Moment[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    if (!draft.title.trim()) return;
    saveMoment({ ...draft, title: draft.title.trim(), note: draft.note.trim() });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        role="dialog"
        aria-modal="true"
      >
        <h2>Edit moment</h2>
        <div className="field">
          <label htmlFor="m-title">What happened</label>
          <input id="m-title" dir="auto" value={draft.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="m-note">Note</label>
          <textarea
            id="m-note"
            dir="auto"
            rows={5}
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Why it matters, what it felt like, what changed"
          />
        </div>
        <div className="field">
          <label>Area</label>
          <AreaPicker areas={areas} palette={doc.areas} value={draft.area} onChange={(a) => a && set("area", a)} />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="m-date">Date</label>
            <input
              id="m-date"
              type="date"
              value={draft.date}
              onChange={(e) => e.target.value && set("date", e.target.value)}
            />
          </div>
          <button
            type="button"
            className={draft.big ? "toggle on" : "toggle"}
            aria-pressed={draft.big}
            onClick={() => set("big", !draft.big)}
            style={{ alignSelf: "flex-end" }}
          >
            {draft.big ? "★" : "☆"} Turning point
          </button>
        </div>
        <div className="row modal-actions">
          <button type="button" className="danger ghost-danger" onClick={() => setConfirming(true)}>
            Delete
          </button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!draft.title.trim()}>
            Save
          </button>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog
          title="Delete this moment?"
          message={
            <>
              “{moment.title}” will be removed from the log. (With GitHub storage, older
              versions stay in the data repo's history.)
            </>
          }
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            deleteMoment(moment.id);
            onClose();
          }}
        />
      )}
    </div>
  );
}
