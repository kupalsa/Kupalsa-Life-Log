import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useData } from "../lib/DataContext";
import { usePhotoUrl, type PreparedPhoto } from "../lib/photos";
import type { Photo } from "../lib/types";

/** A stored photo, resolved through the private repo or IndexedDB. */
export function PhotoImg({
  photo,
  alt,
  className,
  eager,
}: {
  photo: Photo | undefined;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const { settings } = useData();
  const url = usePhotoUrl(settings, photo?.path);
  const ratio = photo && photo.w && photo.h ? `${photo.w} / ${photo.h}` : undefined;
  return (
    <span className={`photo ${url ? "loaded" : "pending"} ${className ?? ""}`} style={{ aspectRatio: ratio }}>
      {url && <img src={url} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />}
    </span>
  );
}

/** Object URLs for photos that exist only in memory until saved. */
function usePreviewUrls(pending: PreparedPhoto[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = pending.map((p) => URL.createObjectURL(p.blob));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [pending]);
  return urls;
}

interface PickerProps {
  existing?: Photo[];
  pending: PreparedPhoto[];
  onFiles: (files: File[]) => void;
  onRemoveExisting?: (photo: Photo) => void;
  onRemovePending: (index: number) => void;
  busy?: boolean;
  compact?: boolean;
}

/** Click, drop, or paste pictures. Shows what's attached with a remove button on each. */
export function PhotoPicker({
  existing = [],
  pending,
  onFiles,
  onRemoveExisting,
  onRemovePending,
  busy,
  compact,
}: PickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const previews = usePreviewUrls(pending);

  const images = (list: FileList | File[] | null | undefined) =>
    Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const files = images(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  function onPaste(e: ClipboardEvent) {
    const files = images(Array.from(e.clipboardData.items).map((i) => i.getAsFile()).filter((f): f is File => !!f));
    if (files.length) {
      e.preventDefault();
      onFiles(files);
    }
  }

  const count = existing.length + pending.length;

  return (
    <div
      className={`photo-picker ${over ? "over" : ""} ${compact ? "compact" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      {count > 0 && (
        <div className="photo-strip">
          {existing.map((p) => (
            <div key={p.path} className="photo-chip">
              <PhotoImg photo={p} alt="" eager />
              {onRemoveExisting && (
                <button type="button" className="photo-remove" onClick={() => onRemoveExisting(p)} aria-label="Remove photo">
                  ✕
                </button>
              )}
            </div>
          ))}
          {pending.map((p, i) => (
            <div key={p.photo.id} className="photo-chip">
              <span className="photo loaded">{previews[i] && <img src={previews[i]} alt="" />}</span>
              <button type="button" className="photo-remove" onClick={() => onRemovePending(i)} aria-label="Remove photo">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="ghost photo-add" onClick={() => inputRef.current?.click()} disabled={busy}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.5" y="4.5" width="15" height="11.5" rx="2.5" />
          <circle cx="7.5" cy="9" r="1.6" />
          <path d="M3 14.5l4.2-3.6 3.3 2.6 2.6-2 4.4 3.6" />
        </svg>
        {busy ? "Preparing…" : count ? "Add more" : "Photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = images(e.target.files);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
