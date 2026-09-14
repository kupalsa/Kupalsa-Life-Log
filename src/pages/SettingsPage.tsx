import { useState } from "react";
import { useData } from "../lib/DataContext";
import { testConnection } from "../lib/githubStore";
import { normalizeSettings, type AppSettings } from "../lib/settings";
import { useTheme } from "../lib/theme";
import { areaColor } from "../lib/areas";
import { todayISO } from "../lib/dates";

type TestStatus =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok" | "warn" | "bad"; msg: string };

function StorageSection() {
  const { settings, updateSettings, githubReady, localPending, moveLocalToGithub } = useData();
  const [form, setForm] = useState<AppSettings>(settings);
  const [test, setTest] = useState<TestStatus>({ kind: "idle" });
  const [saved, setSaved] = useState(false);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function runTest() {
    setTest({ kind: "testing" });
    try {
      const check = await testConnection(normalizeSettings(form));
      if (!check.canWrite) {
        setTest({
          kind: "warn",
          msg: `Reached ${check.fullName}, but the token is read-only — saving will fail. Give it "Contents: Read and write".`,
        });
      } else if (!check.private) {
        setTest({
          kind: "warn",
          msg: `Connected to ${check.fullName} — but this repo is PUBLIC. Your life log would be visible to anyone. Make it private first.`,
        });
      } else {
        setTest({ kind: "ok", msg: `Connected to ${check.fullName} (private) with write access.` });
      }
    } catch (e) {
      setTest({ kind: "bad", msg: e instanceof Error ? e.message : String(e) });
    }
  }

  const pendingCount = localPending
    ? localPending.moments.length + localPending.versions.length + localPending.income.length
    : 0;

  return (
    <section className="panel">
      <h2>Storage</h2>
      <div className={githubReady ? "notice ok" : "notice warn"}>
        {githubReady
          ? `Saving to github.com/${settings.githubOwner}/${settings.githubRepo} — synced on every device you connect.`
          : "Saving in this browser only. Connect a private GitHub repo to keep it safe and use it on your phone too."}
      </div>

      {localPending && (
        <div className="notice">
          This browser still holds {pendingCount} entr{pendingCount === 1 ? "y" : "ies"} written before
          GitHub was connected.{" "}
          <button className="primary small" onClick={() => moveLocalToGithub()}>
            Move them into GitHub
          </button>
        </div>
      )}

      <details className="setup-steps" open={!githubReady}>
        <summary>How to connect (one time, ~3 minutes)</summary>
        <ol>
          <li>
            Create a new <b>private</b> repo on GitHub, e.g. <code>Life-Log-Data</code>. Leave it empty.
          </li>
          <li>
            Create a{" "}
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
              fine-grained token
            </a>{" "}
            → Repository access: only that repo → Permissions → Contents: <b>Read and write</b>.
          </li>
          <li>Paste your username, the repo name and the token below, test, then save.</li>
        </ol>
      </details>

      <div className="row">
        <div className="field grow">
          <label htmlFor="gh-owner">GitHub username</label>
          <input id="gh-owner" value={form.githubOwner} onChange={(e) => set("githubOwner", e.target.value)} placeholder="kupalsa" autoCapitalize="off" autoCorrect="off" />
        </div>
        <div className="field grow">
          <label htmlFor="gh-repo">Data repository</label>
          <input id="gh-repo" value={form.githubRepo} onChange={(e) => set("githubRepo", e.target.value)} placeholder="Life-Log-Data" autoCapitalize="off" autoCorrect="off" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="gh-token">Personal access token</label>
        <input id="gh-token" type="password" value={form.githubToken} onChange={(e) => set("githubToken", e.target.value)} placeholder="github_pat_…" autoComplete="off" />
      </div>
      <p className="small-note">Kept only in this browser's storage. Never written to any repo.</p>
      <div className="row">
        <button onClick={runTest} disabled={!form.githubOwner || !form.githubRepo || !form.githubToken}>
          Test connection
        </button>
        <button
          className="primary"
          onClick={() => {
            const clean = normalizeSettings(form);
            setForm(clean);
            updateSettings(clean);
            setSaved(true);
          }}
        >
          Save
        </button>
        {githubReady && (
          <button
            className="ghost"
            onClick={() => {
              const empty = { githubOwner: "", githubRepo: "", githubToken: "" };
              setForm(empty);
              updateSettings(empty);
            }}
          >
            Disconnect
          </button>
        )}
        {test.kind === "testing" && <span className="muted">Testing…</span>}
        {saved && <span className="success-text">Saved</span>}
      </div>
      {(test.kind === "ok" || test.kind === "warn" || test.kind === "bad") && (
        <div className={`notice ${test.kind}`} style={{ marginTop: 12, marginBottom: 0 }}>
          {test.msg}
        </div>
      )}
    </section>
  );
}

function AreasSection() {
  const { doc, saveAreas } = useData();
  const [newArea, setNewArea] = useState("");
  const usage = (a: string) => doc.moments.filter((m) => m.area === a).length;

  function rename(i: number, value: string) {
    const clean = value.trim();
    const old = doc.areas[i];
    if (!clean || clean === old || doc.areas.includes(clean)) return;
    const next = doc.areas.map((a, j) => (j === i ? clean : a));
    saveAreas(next, { [old]: clean });
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= doc.areas.length) return;
    const next = [...doc.areas];
    [next[i], next[j]] = [next[j], next[i]];
    saveAreas(next);
  }

  return (
    <section className="panel">
      <h2>Areas of life</h2>
      <p className="small-note" style={{ marginTop: 0 }}>
        Rename freely — existing moments follow. An area can only be removed once nothing uses it.
      </p>
      <ul className="area-list">
        {doc.areas.map((a, i) => (
          <li key={a}>
            <span className="area-dot" style={{ background: areaColor(doc.areas, a) }} />
            <input
              defaultValue={a}
              dir="auto"
              aria-label={`Rename ${a}`}
              onBlur={(e) => rename(i, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <span className="muted count">{usage(a)}</span>
            <button className="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${a} up`}>
              ↑
            </button>
            <button className="icon" onClick={() => move(i, 1)} disabled={i === doc.areas.length - 1} aria-label={`Move ${a} down`}>
              ↓
            </button>
            <button
              className="icon"
              onClick={() => saveAreas(doc.areas.filter((x) => x !== a))}
              disabled={usage(a) > 0 || doc.areas.length <= 1}
              title={usage(a) > 0 ? "Still used by moments" : "Remove"}
              aria-label={`Remove ${a}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = newArea.trim();
          if (!clean || doc.areas.includes(clean)) return;
          saveAreas([...doc.areas, clean]);
          setNewArea("");
        }}
      >
        <input dir="auto" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="New area" />
        <button type="submit" disabled={!newArea.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}

export default function SettingsPage() {
  const { doc, saveCurrency } = useData();
  const [theme, setTheme] = useTheme();

  function exportJson() {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-log-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
        </div>
      </header>

      <StorageSection />
      <AreasSection />

      <section className="panel">
        <h2>Preferences</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="currency">Currency symbol</label>
            <input
              id="currency"
              key={doc.currency}
              defaultValue={doc.currency}
              style={{ width: 80 }}
              onBlur={(e) => {
                const c = e.target.value.trim();
                if (c && c !== doc.currency) saveCurrency(c);
              }}
            />
          </div>
          <div className="field">
            <label>Theme</label>
            <div className="segmented">
              <button className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")}>
                Dark
              </button>
              <button className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")}>
                Light
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Backup</h2>
        <p className="small-note" style={{ marginTop: 0 }}>
          Download everything as one JSON file.
        </p>
        <button onClick={exportJson}>Download backup</button>
      </section>
    </div>
  );
}
