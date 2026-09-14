import { areaColor } from "../lib/areas";

export function AreaTag({ areas, area }: { areas: string[]; area: string }) {
  return (
    <span className="area-tag">
      <span className="area-dot" style={{ background: areaColor(areas, area) }} />
      {area}
    </span>
  );
}

interface PickerProps {
  areas: string[];
  value: string | null;
  onChange: (area: string | null) => void;
  /** Adds a leading "All" chip that maps to null. */
  allowAll?: boolean;
  /** The full list, for colours — defaults to `areas`. */
  palette?: string[];
}

export function AreaPicker({ areas, value, onChange, allowAll, palette }: PickerProps) {
  return (
    <div className="chips">
      {allowAll && (
        <button
          type="button"
          className={value === null ? "chip on" : "chip"}
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          All
        </button>
      )}
      {areas.map((a) => (
        <button
          type="button"
          key={a}
          className={value === a ? "chip on" : "chip"}
          aria-pressed={value === a}
          onClick={() => onChange(allowAll && value === a ? null : a)}
        >
          <span className="area-dot" style={{ background: areaColor(palette ?? areas, a) }} />
          {a}
        </button>
      ))}
    </div>
  );
}
