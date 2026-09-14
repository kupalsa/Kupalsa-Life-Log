import type { AppSettings } from "./settings";

export class GithubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GithubApiError";
  }
}

function apiBase(s: AppSettings): string {
  return `https://api.github.com/repos/${s.githubOwner}/${s.githubRepo}/contents`;
}

function headers(s: AppSettings): HeadersInit {
  return {
    Authorization: `Bearer ${s.githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// UTF-8 safe base64 — notes may be in Russian or Hebrew.
function b64EncodeUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function b64DecodeUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function getFile(
  s: AppSettings,
  path: string,
): Promise<{ content: string; sha: string } | null> {
  // no-store: a cached read hands back a stale sha, and the next write 409s.
  const res = await fetch(`${apiBase(s)}/${path}`, { headers: headers(s), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new GithubApiError(
      res.status === 401
        ? "GitHub rejected the token (401) — it has probably expired. Create a new one in Settings."
        : `GitHub read failed (${res.status}) for ${path}: ${await res.text()}`,
      res.status,
    );
  }
  const data = await res.json();
  return { content: data.content as string, sha: data.sha as string };
}

/**
 * GitHub answers a write the token isn't allowed to make with 404 rather than
 * 403, so a 404 here almost always means the token is read-only.
 */
function writeErrorMessage(status: number, path: string, body: string): string {
  if (status === 404) {
    return (
      `Could not save ${path} — GitHub refused the write (404). The token probably lacks ` +
      `"Contents: Read and write" for this repository. Check it in Settings.`
    );
  }
  if (status === 401) {
    return `Could not save — the token was rejected (401). It has probably expired; create a new one in Settings.`;
  }
  if (status === 409) {
    return `Could not save — the data changed on another device since this page loaded (409). Reload, then redo this change.`;
  }
  if (status === 403) {
    return `Could not save — forbidden (403). Possibly a rate limit; wait a minute and retry.`;
  }
  return `GitHub write failed (${status}) for ${path}: ${body}`;
}

export async function readJSON<T>(s: AppSettings, path: string): Promise<T | null> {
  const file = await getFile(s, path);
  if (!file) return null;
  return JSON.parse(b64DecodeUtf8(file.content)) as T;
}

export async function writeJSON<T>(
  s: AppSettings,
  path: string,
  data: T,
  message: string,
): Promise<void> {
  const existing = await getFile(s, path);
  const res = await fetch(`${apiBase(s)}/${path}`, {
    method: "PUT",
    headers: { ...headers(s), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: b64EncodeUtf8(JSON.stringify(data, null, 2)),
      ...(existing ? { sha: existing.sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new GithubApiError(writeErrorMessage(res.status, path, await res.text()), res.status);
  }
}

export interface ConnectionCheck {
  fullName: string;
  /** False when the token can read the repo but not write to it. */
  canWrite: boolean;
  private: boolean;
}

/** Checks `permissions.push` — a read-only token reaches the repo fine, then every save fails. */
export async function testConnection(s: AppSettings): Promise<ConnectionCheck> {
  const res = await fetch(`https://api.github.com/repos/${s.githubOwner}/${s.githubRepo}`, {
    headers: headers(s),
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new GithubApiError(
        `No repository "${s.githubOwner}/${s.githubRepo}" is visible to this token. ` +
          `Check the names, and that the token grants access to this repo.`,
        404,
      );
    }
    if (res.status === 401) {
      throw new GithubApiError("The token was rejected (401) — it has probably expired.", 401);
    }
    throw new GithubApiError(`Could not reach repo (${res.status}): ${await res.text()}`, res.status);
  }
  const data = await res.json();
  return {
    fullName: data.full_name as string,
    canWrite: Boolean(data.permissions?.push),
    private: Boolean(data.private),
  };
}
