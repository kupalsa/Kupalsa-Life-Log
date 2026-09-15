import { useEffect, useState } from "react";
import type { Photo } from "../lib/types";
import { PhotoImg } from "./Photos";

export default function Lightbox({
  photos,
  start,
  caption,
  onClose,
}: {
  photos: Photo[];
  start: number;
  caption: string;
  onClose: () => void;
}) {
  const [i, setI] = useState(start);
  const many = photos.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => (x + 1) % photos.length);
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={caption}>
      <div className="lightbox-frame" onClick={(e) => e.stopPropagation()}>
        <PhotoImg photo={photos[i]} alt={caption} eager />
        <div className="lightbox-bar">
          <span dir="auto">{caption}</span>
          {many && (
            <span className="row">
              <button className="small" onClick={() => setI((x) => (x - 1 + photos.length) % photos.length)} aria-label="Previous photo">
                ‹
              </button>
              <span className="muted">
                {i + 1} / {photos.length}
              </span>
              <button className="small" onClick={() => setI((x) => (x + 1) % photos.length)} aria-label="Next photo">
                ›
              </button>
            </span>
          )}
          <button className="small ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
