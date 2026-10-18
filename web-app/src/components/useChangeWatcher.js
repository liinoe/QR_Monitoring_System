import { useEffect, useRef } from "react";
import { authFetch } from "../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const CHECK_MS = 5000; // one shared check every 5 seconds

// ---- One shared "did anything change?" check for the whole website ----
// Every page and the sidebar badge listen to the SAME request to /api/admin/changes,
// so only one small request goes out every 5 seconds, no matter how many parts of
// the screen are watching. Checks pause while the browser tab is hidden.
const listeners = new Set();
let timer = null;
let checking = null;  // the check that is running right now (so two don't overlap)
let latest = null;    // the newest answer from the server

// Asks the server once and tells every listener whose data changed.
function runCheck() {
  if (document.visibilityState === "hidden") return Promise.resolve();
  if (checking) return checking;
  checking = (async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/changes`);
      if (!response.ok) return;
      latest = await response.json();
      listeners.forEach((l) => l.receive(latest));
    } catch {
      // server unreachable for a moment — try again next time
    } finally {
      checking = null;
    }
  })();
  return checking;
}

// Checks right away when the admin comes back to this tab.
function onVisible() {
  if (document.visibilityState === "visible") runCheck();
}

// Adds a listener; starts the shared timer when the first one arrives.
function addListener(listener) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(runCheck, CHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  if (latest) listener.receive(latest); // start from the newest known answer
  else runCheck();
}

// Removes a listener; stops the shared timer when nobody is watching.
function removeListener(listener) {
  listeners.delete(listener);
  if (listeners.size === 0 && timer) {
    clearInterval(timer);
    timer = null;
    latest = null;
    document.removeEventListener("visibilitychange", onVisible);
  }
}

// ---- The hook pages use ----
//   parts      which data the page uses: "logs", "guests", "registrations", "students"
//   onChange   called as onChange(now, before) when one of those parts changed
//   fullRefreshMs  safety net: also call onChange this often even if nothing seems
//              changed (keeps "today" numbers right after midnight). 0 = off.
export default function useChangeWatcher(parts, onChange, { fullRefreshMs = 5 * 60 * 1000 } = {}) {
  const callback = useRef(onChange);
  callback.current = onChange; // always call the newest version of the page's function
  const partsKey = parts.join(",");

  useEffect(() => {
    const watched = partsKey.split(",");
    let last = null; // the answer this page saw last time

    const listener = {
      // First answer only sets the starting point; after that, call onChange when a watched part differs.
      receive(now) {
        const before = last;
        last = now;
        if (before && watched.some((p) => now[p] !== before[p])) callback.current(now, before);
      },
    };
    addListener(listener);

    const full = fullRefreshMs > 0 ? setInterval(() => {
      if (document.visibilityState !== "hidden") callback.current(last, last);
    }, fullRefreshMs) : null;

    return () => {
      removeListener(listener);
      if (full) clearInterval(full);
    };
  }, [partsKey, fullRefreshMs]);
}
