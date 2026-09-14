/** Categorical slots defined in index.css (validated order, per theme). */
const SLOTS = 8;

/**
 * An area's colour follows its position in the area list, so it stays put
 * when filters hide other areas. Past eight there is no ninth hue — extra
 * areas get neutral ink, and every dot sits beside its name anyway.
 */
export function areaColor(areas: string[], area: string): string {
  const i = areas.indexOf(area);
  return i >= 0 && i < SLOTS ? `var(--cat-${i + 1})` : "var(--text-dim)";
}
