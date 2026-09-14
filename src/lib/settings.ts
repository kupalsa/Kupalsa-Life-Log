export interface AppSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
}

const STORAGE_KEY = "life-log-settings";

export const emptySettings: AppSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
};

/**
 * Every field ends up in a URL or an auth header, where a stray space from a
 * copy-paste is invisible in the input and fatal to the request. Trim on the way
 * in and on the way out.
 */
export function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  return {
    githubToken: (raw.githubToken ?? "").trim(),
    githubOwner: (raw.githubOwner ?? "").trim(),
    githubRepo: (raw.githubRepo ?? "").trim(),
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...emptySettings };
    return normalizeSettings({ ...emptySettings, ...JSON.parse(raw) });
  } catch {
    return { ...emptySettings };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function isGithubConfigured(s: AppSettings): boolean {
  return Boolean(s.githubToken && s.githubOwner && s.githubRepo);
}
