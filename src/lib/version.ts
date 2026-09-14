/** The build this running app came from. */
export const RUNNING_VERSION: string =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/**
 * Records which version we already reloaded for, so a cache that won't
 * revalidate can't trap the app in a reload loop.
 */
const ATTEMPT_KEY = "life-log-update-reload";

export function reloadAlreadyTried(version: string): boolean {
  try {
    return sessionStorage.getItem(ATTEMPT_KEY) === version;
  } catch {
    return false;
  }
}

export function markReloadTried(version: string): void {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, version);
  } catch {
    // Storage disabled: worst case we show the banner.
  }
}

/** The version currently deployed, or null if it can't be determined. */
export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const url = new URL("version.json", document.baseURI);
    url.searchParams.set("t", String(Date.now()));
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const version = (data as { version?: unknown })?.version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

/** Reload from the network rather than the back/forward cache. */
export function hardReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  window.location.replace(url.toString());
}
