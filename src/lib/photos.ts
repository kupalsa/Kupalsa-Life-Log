import { useEffect, useState } from "react";

import { isGithubConfigured, type AppSettings } from "./settings";
import { fetchRepoBlob } from "./githubStore";
import { newId, type Photo } from "./types";

/**
 * Photos never go into the JSON doc — a year of pictures would make every save
 * megabytes. In GitHub mode each photo is its own file in the data repo; in
 * browser-only mode it sits in IndexedDB until moved into GitHub.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export interface PreparedPhoto {
  photo: Photo;
  blob: Blob;
}

/** Downscale + re-encode as JPEG. Also strips EXIF (location) as a side effect. */
export async function preparePhoto(file: File, date: string): Promise<PreparedPhoto> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), "image/jpeg", QUALITY),
  );
  const id = newId();
  return { photo: { id, path: `photos/${date.slice(0, 4)}/${id}.jpg`, w, h }, blob };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Safari decodes some formats (HEIC) only through <img>.
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Can't read ${file.name} as an image.`));
        img.src = url;
      });
    } finally {
      // Revoked after decode; the drawn canvas no longer needs it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// --- IndexedDB (browser-only mode) ---

const DB_NAME = "life-log-photos";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const localPhotos = {
  put: (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id)).then(() => undefined),
  get: (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(id)),
  remove: (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined),
};

export const isLocalPath = (path: string) => path.startsWith("local:");

// --- Display ---

const urlCache = new Map<string, Promise<string>>();

export function photoUrl(settings: AppSettings, path: string): Promise<string> {
  const key = isLocalPath(path) ? path : `${settings.githubOwner}/${settings.githubRepo}/${path}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const load = (async () => {
    if (isLocalPath(path)) {
      const blob = await localPhotos.get(path.slice(6));
      if (!blob) throw new Error("Photo missing from this browser.");
      return URL.createObjectURL(blob);
    }
    if (!isGithubConfigured(settings)) throw new Error("Connect GitHub to load this photo.");
    return URL.createObjectURL(await fetchRepoBlob(settings, path));
  })();
  load.catch(() => urlCache.delete(key));
  urlCache.set(key, load);
  return load;
}

/** Seeds the cache right after an upload so the photo shows without a refetch. */
export function primePhotoUrl(settings: AppSettings, path: string, blob: Blob): void {
  const key = isLocalPath(path) ? path : `${settings.githubOwner}/${settings.githubRepo}/${path}`;
  urlCache.set(key, Promise.resolve(URL.createObjectURL(blob)));
}

export function usePhotoUrl(settings: AppSettings, path: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let alive = true;
    setUrl(null);
    photoUrl(settings, path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [settings, path]);
  return url;
}
