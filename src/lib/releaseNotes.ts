import type { ReleaseNotes } from "./types";

export const NOTE_SECTIONS: { key: keyof ReleaseNotes; label: string; mark: string; hint: string }[] = [
  { key: "added", label: "New", mark: "✦", hint: "Habits, skills, people, places that came into your life" },
  { key: "improved", label: "Improved", mark: "↑", hint: "What got stronger or better" },
  { key: "fixed", label: "Fixed", mark: "✓", hint: "Problems you actually solved" },
  { key: "removed", label: "Removed", mark: "−", hint: "What you let go of" },
  { key: "known", label: "Known issues", mark: "!", hint: "Still working on it — carried into the next version" },
];
