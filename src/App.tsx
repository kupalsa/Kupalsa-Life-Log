import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { DataProvider, useData } from "./lib/DataContext";
import { useTheme } from "./lib/theme";
import UpdateNotice from "./components/UpdateNotice";
import NowPage from "./pages/NowPage";
import StoryPage from "./pages/StoryPage";
import CalendarPage from "./pages/CalendarPage";
import LaddersPage from "./pages/LaddersPage";
import MoneyPage from "./pages/MoneyPage";
import VersionsPage from "./pages/VersionsPage";
import SettingsPage from "./pages/SettingsPage";

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    {d}
  </svg>
);

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Shown in the phone's bottom bar; the rest live under More. */
  primary: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Now", primary: true, icon: svg(<><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2" /></>) },
  { to: "/story", label: "Story", primary: true, icon: svg(<><path d="M10 3v14" /><circle cx="10" cy="5" r="1.8" /><circle cx="10" cy="11" r="1.8" /><path d="M7.5 15.5 10 18l2.5-2.5" /></>) },
  { to: "/calendar", label: "Calendar", primary: true, icon: svg(<><rect x="3" y="4.5" width="14" height="12.5" rx="2" /><path d="M3 8.5h14M7 2.5v4M13 2.5v4" /></>) },
  { to: "/ladders", label: "Ladders", primary: true, icon: svg(<path d="M3 17h4v-4h4V9h4V4h2" />) },
  { to: "/money", label: "Money", primary: false, icon: svg(<path d="M3 17h14M5.5 17v-5M10 17V7M14.5 17V3.5" />) },
  { to: "/versions", label: "Versions", primary: false, icon: svg(<><path d="M10 2.5 17 6l-7 3.5L3 6z" /><path d="m3 10 7 3.5 7-3.5M3 14l7 3.5 7-3.5" /></>) },
  { to: "/settings", label: "Settings", primary: false, icon: svg(<><circle cx="10" cy="10" r="2.6" /><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" /></>) },
];

function SyncStatus() {
  const { githubReady, saving, loading } = useData();
  return (
    <div className="sync-status">
      <span className={githubReady ? "sync-dot ok" : "sync-dot warn"} />
      {saving ? "Saving…" : loading ? "Loading…" : githubReady ? "Synced to GitHub" : "This browser only"}
    </div>
  );
}

function Sidebar() {
  const { githubReady } = useData();
  const [theme, setTheme] = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const link = (item: NavItem, extra = "") => (
    <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-link ${extra} ${isActive ? "active" : ""}`}>
      {item.icon}
      <span>{item.label}</span>
      {item.to === "/settings" && !githubReady && <span className="nav-dot" title="Not connected to GitHub" />}
    </NavLink>
  );

  const secondaryActive = NAV.some((n) => !n.primary && location.pathname.startsWith(n.to) && n.to !== "/");

  return (
    <>
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Life Log
        </div>
        {NAV.map((item) => link(item, item.primary ? "" : "secondary"))}
        <button className={`nav-link more-button ${secondaryActive ? "active" : ""}`} onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}>
          {svg(<><circle cx="4.5" cy="10" r="1.4" /><circle cx="10" cy="10" r="1.4" /><circle cx="15.5" cy="10" r="1.4" /></>)}
          <span>More</span>
          {!githubReady && <span className="nav-dot" />}
        </button>
        <div className="sidebar-footer">
          <SyncStatus />
          <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "◗ Night" : "◖ Day"}
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="more-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => !n.primary).map((item) => link(item))}
            <div className="more-footer">
              <SyncStatus />
              <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                {theme === "light" ? "◗ Night" : "◖ Day"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <DataProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <ErrorBanner />
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<NowPage />} />
            <Route path="/story" element={<StoryPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/ladders" element={<LaddersPage />} />
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
