import type { Ladder, Moment } from "../lib/types";
import { ladderProgress } from "../lib/ladders";

interface Props {
  ladders: Ladder[];
  moments: Moment[];
  value: Moment["ladder"];
  onChange: (value: Moment["ladder"]) => void;
}

/** Marks a moment as reaching a level. Defaults to the next level up. */
export default function LadderFields({ ladders, moments, value, onChange }: Props) {
  const ladder = ladders.find((l) => l.id === value?.ladderId);

  return (
    <div className="ladder-fields">
      <select
        value={value?.ladderId ?? ""}
        onChange={(e) => {
          const next = ladders.find((l) => l.id === e.target.value);
          if (!next) return onChange(null);
          const p = ladderProgress(next, moments);
          onChange({ ladderId: next.id, level: p.next ?? next.levels[next.levels.length - 1] ?? "" });
        }}
        aria-label="Ladder"
      >
        <option value="">Ladder…</option>
        {ladders.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      {ladder && value && (
        <select
          value={value.level}
          onChange={(e) => onChange({ ladderId: ladder.id, level: e.target.value })}
          aria-label="Level reached"
        >
          {ladder.levels.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
