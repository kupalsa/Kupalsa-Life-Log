import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  isGithubConfigured,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type AppSettings,
} from "./settings";
import { deleteFile, readJSON, writeBinary, writeJSON } from "./githubStore";
import {
  docHasContent,
  emptyDoc,
  mergeDocs,
  normalizeDoc,
  type IncomeMonth,
  type Ladder,
  type LifeDoc,
  type Moment,
  type Photo,
  type Version,
} from "./types";
import {
  blobToBase64,
  isLocalPath,
  localPhotos,
  primePhotoUrl,
  type PreparedPhoto,
} from "./photos";

/** Everything but photos lives in this one file in the private data repo. */
const DATA_PATH = "data/life-log.json";
/** Until GitHub is connected, the log lives in this browser. */
const LOCAL_KEY = "life-log-local-data";

function loadLocal(): LifeDoc {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalizeDoc(JSON.parse(raw)) : emptyDoc();
  } catch {
    return emptyDoc();
  }
}

function clearLocal(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

interface DataContextValue {
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  githubReady: boolean;

  doc: LifeDoc;
  /** False until the first load finishes — avoids flashing an empty log. */
  ready: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  dismissError: () => void;
  refresh: () => Promise<void>;

  // Each resolves true once the change is safely stored.
  /** Uploads `newPhotos` first; photos dropped from the moment are deleted after. */
  saveMoment: (m: Moment, newPhotos?: PreparedPhoto[]) => Promise<boolean>;
  deleteMoment: (id: string) => Promise<boolean>;
  saveVersion: (v: Version) => Promise<boolean>;
  deleteVersion: (id: string) => Promise<boolean>;
  saveLadder: (l: Ladder) => Promise<boolean>;
  deleteLadder: (id: string) => Promise<boolean>;
  /** null removes the month. */
  saveIncome: (month: string, entry: Omit<IncomeMonth, "month"> | null) => Promise<boolean>;
  /** `renames` maps old area names to new ones, carried onto existing moments and ladders. */
  saveAreas: (areas: string[], renames?: Record<string, string>) => Promise<boolean>;
  saveCurrency: (currency: string) => Promise<boolean>;

  /** Entries written in this browser before GitHub was connected. */
  localPending: LifeDoc | null;
  moveLocalToGithub: () => Promise<boolean>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const githubReady = isGithubConfigured(settings);

  const [doc, setDoc] = useState<LifeDoc>(() => (githubReady ? emptyDoc() : loadLocal()));
  const [ready, setReady] = useState(!githubReady);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localPending, setLocalPending] = useState<LifeDoc | null>(null);

  // The latest doc, readable synchronously: two quick saves must each build on
  // the other, not both on whatever the last render saw.
  const docRef = useRef(doc);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const loadId = useRef(0);

  const commit = useCallback((next: LifeDoc) => {
    docRef.current = next;
    setDoc(next);
  }, []);

  const report = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  const updateSettings = useCallback((s: AppSettings) => {
    const clean = normalizeSettings(s);
    setSettings(clean);
    saveSettings(clean);
  }, []);

  const refresh = useCallback(async () => {
    const id = ++loadId.current;
    const local = loadLocal();
    if (!isGithubConfigured(settings)) {
      commit(local);
      setLocalPending(null);
      setReady(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await readJSON<unknown>(settings, DATA_PATH);
      if (id !== loadId.current) return;
      commit(normalizeDoc(raw));
      setLocalPending(docHasContent(local) ? local : null);
      setReady(true);
    } catch (e) {
      if (id === loadId.current) report(e);
    } finally {
      if (id === loadId.current) setLoading(false);
    }
  }, [settings, commit, report]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Runs storage work one job at a time, in order, with the saving indicator on. */
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    setBusy((n) => n + 1);
    const run = writeQueue.current.then(job).finally(() => setBusy((n) => n - 1));
    writeQueue.current = run.catch(() => undefined);
    return run;
  }, []);

  /**
   * Applies a change on screen immediately, then stores it. If the write fails
   * the error is shown and the screen goes back to the last stored state,
   * unless newer changes were already made on top of it.
   */
  const mutate = useCallback(
    (change: (d: LifeDoc) => LifeDoc, message: string): Promise<boolean> => {
      const before = docRef.current;
      const next = normalizeDoc(change(before));
      commit(next);
      return enqueue(async () => {
        try {
          if (isGithubConfigured(settings)) {
            await writeJSON(settings, DATA_PATH, next, message);
          } else {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
          }
          return true;
        } catch (e) {
          report(e);
          if (docRef.current === next) commit(before);
          return false;
        }
      });
    },
    [settings, commit, enqueue, report],
  );

  /** Stores prepared photos and returns them with their final paths. */
  const storePhotos = useCallback(
    (prepared: PreparedPhoto[]): Promise<Photo[] | null> =>
      enqueue(async () => {
        const stored: Photo[] = [];
        try {
          for (const { photo, blob } of prepared) {
            if (isGithubConfigured(settings)) {
              await writeBinary(settings, photo.path, await blobToBase64(blob), "Add photo");
              primePhotoUrl(settings, photo.path, blob);
              stored.push(photo);
            } else {
              await localPhotos.put(photo.id, blob);
              const local = { ...photo, path: `local:${photo.id}` };
              primePhotoUrl(settings, local.path, blob);
              stored.push(local);
            }
          }
          return stored;
        } catch (e) {
          report(e);
          return null;
        }
      }),
    [settings, enqueue, report],
  );

  /** Best-effort cleanup; a leftover file is not worth failing a delete over. */
  const discardPhotos = useCallback(
    (photos: Photo[]) => {
      if (!photos.length) return;
      enqueue(async () => {
        for (const p of photos) {
          try {
            if (isLocalPath(p.path)) await localPhotos.remove(p.path.slice(6));
            else if (isGithubConfigured(settings)) await deleteFile(settings, p.path, "Remove photo");
          } catch {
            // Ignore — the record referencing it is already gone.
          }
        }
      });
    },
    [settings, enqueue],
  );

  const saveMoment = useCallback(
    async (m: Moment, newPhotos: PreparedPhoto[] = []) => {
      let photos = m.photos;
      if (newPhotos.length) {
        const stored = await storePhotos(newPhotos);
        if (!stored) return false;
        photos = [...m.photos, ...stored];
      }
      const moment = { ...m, photos };
      const previous = docRef.current.moments.find((x) => x.id === m.id);
      const ok = await mutate((d) => {
        const exists = d.moments.some((x) => x.id === m.id);
        return {
          ...d,
          moments: exists ? d.moments.map((x) => (x.id === m.id ? moment : x)) : [...d.moments, moment],
        };
      }, `Log moment ${m.date}: ${m.title.slice(0, 60)}`);
      if (ok && previous) {
        const kept = new Set(photos.map((p) => p.path));
        discardPhotos(previous.photos.filter((p) => !kept.has(p.path)));
      }
      return ok;
    },
    [mutate, storePhotos, discardPhotos],
  );

  const deleteMoment = useCallback(
    async (id: string) => {
      const target = docRef.current.moments.find((x) => x.id === id);
      const ok = await mutate((d) => ({ ...d, moments: d.moments.filter((x) => x.id !== id) }), "Delete moment");
      if (ok && target) discardPhotos(target.photos);
      return ok;
    },
    [mutate, discardPhotos],
  );

  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

  const saveVersion = useCallback(
    (v: Version) => mutate((d) => ({ ...d, versions: upsert(d.versions, v) }), `Release version ${v.name}`),
    [mutate],
  );

  const deleteVersion = useCallback(
    (id: string) => mutate((d) => ({ ...d, versions: d.versions.filter((x) => x.id !== id) }), "Delete version"),
    [mutate],
  );

  const saveLadder = useCallback(
    (l: Ladder) => mutate((d) => ({ ...d, ladders: upsert(d.ladders, l) }), `Save ladder ${l.name}`),
    [mutate],
  );

  const deleteLadder = useCallback(
    (id: string) =>
      mutate(
        (d) => ({
          ...d,
          ladders: d.ladders.filter((x) => x.id !== id),
          // The moments stay; they just stop counting as ladder steps.
          moments: d.moments.map((m) => (m.ladder?.ladderId === id ? { ...m, ladder: null } : m)),
        }),
        "Delete ladder",
      ),
    [mutate],
  );

  const saveIncome = useCallback(
    (month: string, entry: Omit<IncomeMonth, "month"> | null) =>
      mutate(
        (d) => ({
          ...d,
          income: [...d.income.filter((x) => x.month !== month), ...(entry ? [{ month, ...entry }] : [])],
        }),
        entry ? `Income ${month}` : `Remove income ${month}`,
      ),
    [mutate],
  );

  const saveAreas = useCallback(
    (areas: string[], renames: Record<string, string> = {}) =>
      mutate(
        (d) => ({
          ...d,
          areas,
          moments: d.moments.map((m) => (renames[m.area] ? { ...m, area: renames[m.area] } : m)),
          ladders: d.ladders.map((l) => (renames[l.area] ? { ...l, area: renames[l.area] } : l)),
        }),
        "Update areas",
      ),
    [mutate],
  );

  const saveCurrency = useCallback(
    (currency: string) => mutate((d) => ({ ...d, currency }), "Update currency"),
    [mutate],
  );

  const moveLocalToGithub = useCallback(async () => {
    if (!localPending) return true;
    // Photos first: the doc must never point at files that aren't in the repo.
    const moved = await enqueue(async () => {
      try {
        const moments: Moment[] = [];
        for (const m of localPending.moments) {
          const photos: Photo[] = [];
          for (const p of m.photos) {
            if (!isLocalPath(p.path)) {
              photos.push(p);
              continue;
            }
            const blob = await localPhotos.get(p.path.slice(6));
            if (!blob) continue;
            const path = `photos/${m.date.slice(0, 4)}/${p.id}.jpg`;
            await writeBinary(settings, path, await blobToBase64(blob), "Move photo from browser");
            primePhotoUrl(settings, path, blob);
            photos.push({ ...p, path });
          }
          moments.push({ ...m, photos });
        }
        return { ...localPending, moments };
      } catch (e) {
        report(e);
        return null;
      }
    });
    if (!moved) return false;
    const ok = await mutate((d) => mergeDocs(d, moved), "Import entries logged in the browser");
    if (ok) {
      for (const m of localPending.moments) {
        for (const p of m.photos) if (isLocalPath(p.path)) localPhotos.remove(p.path.slice(6)).catch(() => undefined);
      }
      clearLocal();
      setLocalPending(null);
    }
    return ok;
  }, [localPending, mutate, enqueue, settings, report]);

  const dismissError = useCallback(() => setError(null), []);

  const value = useMemo<DataContextValue>(
    () => ({
      settings,
      updateSettings,
      githubReady,
      doc,
      ready,
      loading,
      saving: busy > 0,
      error,
      dismissError,
      refresh,
      saveMoment,
      deleteMoment,
      saveVersion,
      deleteVersion,
      saveLadder,
      deleteLadder,
      saveIncome,
      saveAreas,
      saveCurrency,
      localPending,
      moveLocalToGithub,
    }),
    [
      settings,
      updateSettings,
      githubReady,
      doc,
      ready,
      loading,
      busy,
      error,
      dismissError,
      refresh,
      saveMoment,
      deleteMoment,
      saveVersion,
      deleteVersion,
      saveLadder,
      deleteLadder,
      saveIncome,
      saveAreas,
      saveCurrency,
      localPending,
      moveLocalToGithub,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
