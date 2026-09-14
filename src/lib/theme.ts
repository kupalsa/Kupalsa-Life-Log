import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "life-log-theme";
const EVENT = "life-log-theme-change";

/** Dark is the design's native state; light is the opt-in. */
export function loadTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}

/** Shared theme state — the sidebar toggle and Settings stay in sync. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    const sync = () => setThemeState(loadTheme());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    applyTheme(t);
    setThemeState(t);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [theme, setTheme];
}
