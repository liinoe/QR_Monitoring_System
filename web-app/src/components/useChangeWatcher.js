import { useEffect, useRef } from "react";
import { authFetch } from "../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Watches the server's small "did anything change?" check (/api/admin/changes)
// and calls onChange only when something this page cares about is different.
// This replaces downloading every log every few seconds.
//
//   parts       which data the page uses: "logs", "guests", "registrations", "students"
//   onChange    called with the latest check result when one of those parts changed
//   intervalMs  how often to check (default 5 seconds)
//   fullRefreshMs  safety net: also call onChange this often even if nothing seems
//               changed (keeps "today" numbers right after midnight). 0 = off.
//
// Checks pause while the browser tab is hidden and run again as soon as it's visible.
export default function useChangeWatcher(parts, onChange, { intervalMs = 5000, fullRefreshMs = 5 * 60 * 1000 } = {}) {
  const last = useRef(null);      // the last check result we saw
  const callback = useRef(onChange);
  callback.current = onChange;    // always call the newest version of the page's function
  const partsKey = parts.join(",");

  useEffect(() => {
    const watched = partsKey.split(",");

    // Asks the server for the signatures and compares them with last time.
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await authFetch(`${API_URL}/api/admin/changes`);
        if (!response.ok) return;
        const now = await response.json();
        const before = last.current;
        last.current = now;
        if (before && watched.some((p) => now[p] !== before[p])) callback.current(now);
      } catch {
        // server unreachable for a moment — try again next time
      }
    };

    check(); // first check only remembers the starting point
    const interval = setInterval(check, intervalMs);
    const full = fullRefreshMs > 0 ? setInterval(() => {
      if (document.visibilityState !== "hidden") callback.current(last.current);
    }, fullRefreshMs) : null;
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      if (full) clearInterval(full);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [partsKey, intervalMs, fullRefreshMs]);
}
