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
import { readJSON, writeJSON } from "./githubStore";
import {
  docHasContent,
  emptyDoc,
  mergeDocs,
  normalizeDoc,
  type IncomeMonth,
  type LifeDoc,
  type Moment,
  type Version,
} from "./types";

/** Everything lives in this one file in the private data repo. */
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
  saveMoment: (m: Moment) => Promise<boolean>;
  deleteMoment: (id: string) => Promise<boolean>;
  saveVersion: (v: Version) => Promise<boolean>;
  deleteVersion: (id: string) => Promise<boolean>;
  /** null removes the month. */
  saveIncome: (month: string, entry: Omit<IncomeMonth, "month"> | null) => Promise<boolean>;
  /** `renames` maps old area names to new ones, carried onto existing moments. */
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
  const [pendingWrites, setPendingWrites] = useState(0);
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
      if (id !== loadId.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === loadId.current) setLoading(false);
    }
  }, [settings, commit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Applies a change on screen immediately, then stores it. Writes run one at a
   * time, in order. If a write fails the error is shown and the screen goes
   * back to the last stored state, unless newer changes were already made on
   * top of it.
   */
  const mutate = useCallback(
    (change: (d: LifeDoc) => LifeDoc, message: string): Promise<boolean> => {
      const before = docRef.current;
      const next = normalizeDoc(change(before));
      commit(next);
      setPendingWrites((n) => n + 1);

      const run = writeQueue.current.then(async () => {
        try {
          if (isGithubConfigured(settings)) {
            await writeJSON(settings, DATA_PATH, next, message);
          } else {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
          }
          return true;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          if (docRef.current === next) commit(before);
          return false;
        } finally {
          setPendingWrites((n) => n - 1);
        }
      });
      writeQueue.current = run;
      return run;
    },
    [settings, commit],
  );

  const saveMoment = useCallback(
    (m: Moment) =>
      mutate((d) => {
        const exists = d.moments.some((x) => x.id === m.id);
        return {
          ...d,
          moments: exists ? d.moments.map((x) => (x.id === m.id ? m : x)) : [...d.moments, m],
        };
      }, `Log moment ${m.date}: ${m.title.slice(0, 60)}`),
    [mutate],
  );

  const deleteMoment = useCallback(
    (id: string) =>
      mutate((d) => ({ ...d, moments: d.moments.filter((x) => x.id !== id) }), "Delete moment"),
    [mutate],
  );

  const saveVersion = useCallback(
    (v: Version) =>
      mutate((d) => {
        const exists = d.versions.some((x) => x.id === v.id);
        return {
          ...d,
          versions: exists ? d.versions.map((x) => (x.id === v.id ? v : x)) : [...d.versions, v],
        };
      }, `Save version ${v.name}`),
    [mutate],
  );

  const deleteVersion = useCallback(
    (id: string) =>
      mutate((d) => ({ ...d, versions: d.versions.filter((x) => x.id !== id) }), "Delete version"),
    [mutate],
  );

  const saveIncome = useCallback(
    (month: string, entry: Omit<IncomeMonth, "month"> | null) =>
      mutate(
        (d) => ({
          ...d,
          income: [
            ...d.income.filter((x) => x.month !== month),
            ...(entry ? [{ month, ...entry }] : []),
          ],
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
    const ok = await mutate((d) => mergeDocs(d, localPending), "Import entries logged in the browser");
    if (ok) {
      clearLocal();
      setLocalPending(null);
    }
    return ok;
  }, [localPending, mutate]);

  const dismissError = useCallback(() => setError(null), []);

  const value = useMemo<DataContextValue>(
    () => ({
      settings,
      updateSettings,
      githubReady,
      doc,
      ready,
      loading,
      saving: pendingWrites > 0,
      error,
      dismissError,
      refresh,
      saveMoment,
      deleteMoment,
      saveVersion,
      deleteVersion,
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
      pendingWrites,
      error,
      dismissError,
      refresh,
      saveMoment,
      deleteMoment,
      saveVersion,
      deleteVersion,
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
