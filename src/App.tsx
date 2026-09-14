import { NavLink, Route, Routes } from "react-router-dom";
import { DataProvider, useData } from "./lib/DataContext";
import { useTheme } from "./lib/theme";
import UpdateNotice from "./components/UpdateNotice";
import TimelinePage from "./pages/TimelinePage";
import MoneyPage from "./pages/MoneyPage";
import VersionsPage from "./pages/VersionsPage";
import SettingsPage from "./pages/SettingsPage";

const icon = {
  timeline: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 3v14M5 5.5h10M5 10h7M5 14.5h9" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 17h14M5.5 17v-5M10 17V7M14.5 17V3.5" />
    </svg>
  ),
  versions: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 15l4-4 3 2 7-8M12.5 5H17v4.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" />
    </svg>
  ),
};

function Sidebar() {
  const { githubReady, saving, loading } = useData();
  const [theme, setTheme] = useTheme();

  return (
    <nav className="sidebar">
      <h1>Life Log</h1>
      <NavLink to="/" end>
        {icon.timeline}
        <span>Timeline</span>
      </NavLink>
      <NavLink to="/money">
        {icon.money}
        <span>Money</span>
      </NavLink>
      <NavLink to="/versions">
        {icon.versions}
        <span>Versions</span>
      </NavLink>
      <NavLink to="/settings">
        {icon.settings}
        <span>Settings</span>
        {!githubReady && <span className="nav-dot" title="Not connected to GitHub" />}
      </NavLink>

      <div className="sidebar-footer">
        <div className="sync-status">
          <span className={githubReady ? "sync-dot ok" : "sync-dot warn"} />
          {saving ? "Saving…" : loading ? "Loading…" : githubReady ? "Synced to GitHub" : "This browser only"}
        </div>
        <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? "◗ Dark theme" : "◖ Light theme"}
        </button>
      </div>
    </nav>
  );
}

function ErrorBanner() {
  const { error, dismissError, refresh } = useData();
  if (!error) return null;
  return (
    <div className="notice bad error-banner" role="alert">
      <span>{error}</span>
      <span className="row">
        <button className="small" onClick={() => refresh()}>
          Reload data
        </button>
        <button className="small ghost" onClick={dismissError} aria-label="Dismiss">
          ✕
        </button>
      </span>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <ErrorBanner />
          <Routes>
            <Route path="/" element={<TimelinePage />} />
            <Route path="/money" element={<MoneyPage />} />
            <Route path="/versions" element={<VersionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <UpdateNotice />
      </div>
    </DataProvider>
  );
}
