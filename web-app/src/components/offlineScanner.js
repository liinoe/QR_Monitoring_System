// Helpers for the scanner's OFFLINE MODE (used by pages/scan interface/Scanner.jsx).
//
// Everything is saved in this PC's browser storage (localStorage), so it survives
// a page refresh or a PC restart:
//   qless_scanner_key    the secret key that lets this PC use the offline routes
//   qless_offline_pack   approved students (hashed QR codes) + who is inside
//   qless_offline_queue  scans made while offline, waiting to be synced
//
// Important: always open the scanner in the SAME browser (not Incognito), and
// don't clear its browsing data while scans are waiting to sync.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const KEY_STORAGE = "qless_scanner_key";
const PACK_STORAGE = "qless_offline_pack";
const QUEUE_STORAGE = "qless_offline_queue";

// Reads / writes JSON in localStorage without ever crashing the page.
const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Could not save offline data:", err);
  }
};

// ---------- Scanner key ----------
// Set once by opening /scanner?key=THE_KEY on the library PC; the key is then
// saved here and removed from the address bar.
export function getScannerKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; }
}
export function saveScannerKeyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("key");
  if (!key) return;
  try { localStorage.setItem(KEY_STORAGE, key); } catch { /* storage blocked */ }
  params.delete("key");
  const rest = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
}

// ---------- Hashing ----------
// SHA-256 of the scanned QR code, as hex — the same as MySQL's SHA2(qr_code, 256).
export async function hashQr(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Offline pack ----------
// Shape kept in storage:
//   { savedAt, clockSkewMs, students: { hash: [studentNumber, program, college] },
//     inside: [hash, ...], forcedToday: { hash: "5:31 PM" }, forcedDate: "YYYY-MM-DD", guestsInside }
export function loadPack() {
  return readJson(PACK_STORAGE, null);
}
export function savePack(pack) {
  writeJson(PACK_STORAGE, pack);
}

// Downloads a fresh pack from the server (only works online, with the key).
// Returns the pack, or throws if it couldn't be downloaded.
export async function downloadPack() {
  const key = getScannerKey();
  if (!key) throw new Error("no-key");
  const res = await fetchWithTimeout(`${API_URL}/api/scanner/offline-pack`, { headers: { "x-scanner-key": key } }, 10000);
  if (!res.ok) throw new Error(`pack-${res.status}`);
  const data = await res.json();
  const pack = {
    savedAt: Date.now(),
    // How far this PC's clock is from the server's (to warn about a wrong clock).
    clockSkewMs: Date.now() - new Date(data.server_time).getTime(),
    students: Object.fromEntries(data.students.map(([h, sn, program, college]) => [h, [sn, program, college]])),
    inside: data.inside,
    forcedToday: data.forced_today || {},
    forcedDate: new Date().toDateString(),
    guestsInside: data.guests_inside ?? 0,
  };
  savePack(pack);
  return pack;
}

// ---------- Offline queue ----------
export function loadQueue() {
  return readJson(QUEUE_STORAGE, []);
}
export function saveQueue(queue) {
  writeJson(QUEUE_STORAGE, queue);
}

// Sends the saved scans to the server. Returns how many were handled.
// Scans the server answered for (saved, skipped or duplicate) leave the queue;
// any that failed stay and are tried again next time.
export async function syncQueue() {
  const queue = loadQueue();
  if (queue.length === 0) return 0;
  const key = getScannerKey();
  if (!key) throw new Error("no-key");
  const res = await fetchWithTimeout(`${API_URL}/api/scanner/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-scanner-key": key },
    body: JSON.stringify({ scans: queue }),
  }, 20000);
  if (!res.ok) throw new Error(`sync-${res.status}`);
  const { results = [] } = await res.json();
  const done = new Set(results.filter((r) => r.result !== "error").map((r) => r.offline_scan_id));
  // Keep only scans the server didn't handle (plus any added while this was sending).
  saveQueue(loadQueue().filter((s) => !done.has(s.offline_scan_id)));
  return done.size;
}

// ---------- Network ----------
// fetch() that gives up after `ms` milliseconds (a dead connection can hang for a long time).
export async function fetchWithTimeout(url, options = {}, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// True if a failed request means "server unreachable" (go offline), not a normal error.
// Network errors / timeouts, and 502–504 from Render when the server is down.
export const isOfflineFailure = (errOrStatus) =>
  typeof errOrStatus === "number" ? [502, 503, 504].includes(errOrStatus) : true;
