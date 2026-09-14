import { useCallback, useEffect, useState } from "react";
import {
  fetchDeployedVersion,
  hardReload,
  markReloadTried,
  reloadAlreadyTried,
  RUNNING_VERSION,
} from "../lib/version";

const POLL_MS = 5 * 60 * 1000;

/** True while the user is mid-typing — a reload then would eat what they wrote. */
function isTyping(): boolean {
  const el = document.activeElement;
  return (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.value.trim() !== ""
  );
}

/**
 * Notices a newer deploy and gets onto it: reloads by itself when nothing would
 * be lost, otherwise shows a banner.
 */
export default function UpdateNotice() {
  const [stale, setStale] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (RUNNING_VERSION.startsWith("dev")) return;
    const deployed = await fetchDeployedVersion();
    if (!deployed || deployed === RUNNING_VERSION) return;
    setStale(deployed);
    if (!isTyping() && !reloadAlreadyTried(deployed)) {
      markReloadTried(deployed);
      hardReload();
    }
  }, []);

  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const id = setInterval(check, POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(id);
    };
  }, [check]);

  if (!stale) return null;

  return (
    <div className="update-notice">
      <span>A newer version is available.</span>
      <button className="primary" onClick={hardReload}>
        Reload
      </button>
    </div>
  );
}
