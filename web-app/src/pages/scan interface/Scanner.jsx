import React, { useEffect, useState, useRef, useCallback } from "react";
import ScannerSideBar from "../../components/ScannerSideBar";
import logo from "../../assets/cvsu_logo.png";
import {
  saveScannerKeyFromUrl, getScannerKey, hashQr, loadPack, savePack, downloadPack,
  loadQueue, saveQueue, syncQueue, fetchWithTimeout,
} from "../../components/offlineScanner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Repeat-scan rules (only for the SAME QR code; different students are never blocked):
//   RESTING_MS          reads less than 1 second apart = the phone is still on the scanner
//                       → ignored silently (no message, no sound)
//   ALREADY_SCANNED_MS  scanned again within 5 seconds of a recorded entry/exit
//                       → "Already Scanned" (nothing new is recorded). After 5 seconds
//                       the next scan counts again (e.g. an exit).
const RESTING_MS = 1000;
const ALREADY_SCANNED_MS = 5000;
// ---- Offline mode (see components/offlineScanner.js) ----
const PACK_REFRESH_MS = 5 * 60 * 1000;   // re-download the student list every 5 minutes while online
const SYNC_RETRY_MS = 15 * 1000;         // while offline, try to reconnect / sync every 15 seconds
const SCAN_TIMEOUT_MS = 4000;            // no answer in 4 seconds → treat as offline
const ENTRY_CUTOFF_MINUTES = 17 * 60 + 30; // 5:30 PM: no new entries (same rule as the server)
const AUTO_LOGOUT_MINUTES = 17 * 60 + 31;  // 5:31 PM: everyone inside is logged out
const CLOCK_WARNING_MS = 5 * 60 * 1000;    // warn if this PC's clock is off by 5+ minutes

// Scanner Agent running on THIS library PC (see scanner-agent folder). It tells us
// if the USB scanner is plugged in, even when the website is hosted elsewhere.
const SCANNER_AGENT_URL = import.meta.env.VITE_SCANNER_AGENT_URL || "http://localhost:5055";

// Colors copied from the mobile app (same as GuestLayout.jsx).
const BRAND = { deep: "#0E3B1F", green: "#1B5E20", gold: "#D4A62A", goldLight: "#F0CD5A", mint: "#E8F1E9", page: "#F7F8F7" };

// Board colors per college. COM and CAPS have no official color yet, so they use
// teal and indigo — hues no other college on this board uses.
const COLLEGES = [
  { id: "CAFENR", color: "#16a34a" },
  { id: "CEIT",   color: "#ea580c" },
  { id: "CAS",    color: "#ca8a04" },
  { id: "CON",    color: "#dc2626" },
  { id: "CCJ",    color: "#9333ea" },
  { id: "CSPEAR", color: "#7f1d1d" },
  { id: "CEMDS",  color: "#ef4444" },
  { id: "CTHM",   color: "#f97316" },
  { id: "CED",    color: "#2563eb" },
  { id: "CVMBS",  color: "#ec4899" },
  { id: "COM",    color: "#0d9488" }, // teal (placeholder)
  { id: "CAPS",   color: "#4338ca" }, // indigo (placeholder)
];

// Full college names → short codes used on the board.
const COLLEGE_ACRONYMS = {
  "college of agriculture, food, environment, and natural resources": "CAFENR",
  "college of arts and sciences": "CAS",
  "college of criminal justice": "CCJ",
  "college of education": "CED",
  "college of engineering and information technology": "CEIT",
  "college of economics, management, and development studies": "CEMDS",
  "college of economics, management and development studies": "CEMDS",
  "college of nursing": "CON",
  "college of sports, physical education and recreation": "CSPEAR",
  "college of tourism and hospitality management": "CTHM",
  "college of veterinary medicine and biomedical sciences": "CVMBS",
  "college of medicine": "COM",
  "college of advanced and professional studies": "CAPS",
};

// Turns a full college name into its code (e.g. "College of Nursing" → "CON").
const toAcronym = (college) => {
  if (!college) return null;
  const key = college.trim().toLowerCase();
  return COLLEGE_ACRONYMS[key] || college.trim().toUpperCase();
};

// Look of the result card for each outcome (same tones as the app).
const RESULT_TONES = {
  waiting: { bg: "#FFFFFF", well: "#F4F5F4", fg: "#9CA3AF", pillBg: "#F4F5F4", pillFg: "#6B7280" },
  entry:   { bg: "#F3F9F4", well: "#E8F1E9", fg: "#1B5E20", pillBg: "#1B5E20", pillFg: "#FFFFFF" },
  exit:    { bg: "#FFFBEF", well: "#FBF1CE", fg: "#946800", pillBg: "#946800", pillFg: "#FFFFFF" },
  error:   { bg: "#FEF6F5", well: "#FBDFDB", fg: "#B3261E", pillBg: "#B3261E", pillFg: "#FFFFFF" },
  // Calm gray-blue: "you're already recorded" is not an error
  already: { bg: "#F5F7FA", well: "#E5EAF0", fg: "#475569", pillBg: "#475569", pillFg: "#FFFFFF" },
  offline: { bg: "#FEF6F5", well: "#FBDFDB", fg: "#B3261E", pillBg: "#B3261E", pillFg: "#FFFFFF" },
};

// Header pill for the scanner connection.
const SCANNER_PILLS = {
  connected:    { text: "Scanner connected",     dot: "#4ADE80" },
  disconnected: { text: "Scanner not connected", dot: "#F87171" },
  unknown:      { text: "Scanner status unknown", dot: "#9CA3AF" },
};

// Entry & Exit station: students scan their QR pass with a USB scanner
// (it types the code + Enter). Shows the result and the live board.
const Scanner = () => {
  const [scanResult, setScanResult] = useState(null);
  // The last few results (newest first), shown under the result card so a student
  // still sees theirs when the next person scans right after them.
  const [recentResults, setRecentResults] = useState([]);
  const [status, setStatus] = useState("searching");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [boardData, setBoardData] = useState({});
  const [totalInside, setTotalInside] = useState(0);
  const [guestsInside, setGuestsInside] = useState(0);
  // "connected" | "disconnected" | "unknown" (agent not running / scanner not set up)
  const [scannerState, setScannerState] = useState("unknown");

  const lastKeyTimeRef = useRef(Date.now());
  const audioCtxRef = useRef(null);
  // Recent scans per QR code: { lastSeen, recordedAt, recorded: { action, name, at } }
  // (see RESTING_MS / ALREADY_SCANNED_MS at the top)
  const recentScansRef = useRef(new Map());

  // ---- Offline mode state ----
  // offlineMode: the server can't be reached, so scans are checked and saved on this PC.
  const [savedPack] = useState(loadPack); // the student list saved on this PC (read once)
  const [offlineMode, setOfflineMode] = useState(false);
  const [queueCount, setQueueCount] = useState(() => loadQueue().length); // scans waiting to sync
  const [packSavedAt, setPackSavedAt] = useState(savedPack?.savedAt || null);
  const [clockSkewMs, setClockSkewMs] = useState(savedPack?.clockSkewMs || 0);
  const offlineRef = useRef(false);        // same as offlineMode, readable inside timers
  const syncingRef = useRef(false);        // a sync is running right now
  const packRef = useRef(savedPack);       // saved student list (hashed QR codes)
  const insideRef = useRef(new Set(savedPack?.inside || [])); // who's inside (hashes)

  // Switches offline mode on/off (state for the screen + ref for the timers).
  const setOffline = (value) => {
    offlineRef.current = value;
    setOfflineMode(value);
  };

  // Saves the "who's inside" list back into the stored pack.
  const persistInside = () => {
    if (!packRef.current) return;
    packRef.current = { ...packRef.current, inside: Array.from(insideRef.current) };
    savePack(packRef.current);
  };

  // Downloads a fresh student list while online (needs the scanner key).
  const refreshPack = async () => {
    try {
      const pack = await downloadPack();
      packRef.current = pack;
      insideRef.current = new Set(pack.inside);
      setPackSavedAt(pack.savedAt);
      setClockSkewMs(pack.clockSkewMs);
    } catch {
      // No key yet, or offline — keep using the saved one.
    }
  };

  // Live board numbers worked out on this PC (used while offline).
  const showLocalBoard = () => {
    const counts = {};
    insideRef.current.forEach((h) => {
      const college = packRef.current?.students?.[h]?.[2];
      const code = toAcronym(college);
      if (code) counts[code] = (counts[code] || 0) + 1;
    });
    setBoardData(counts);
    setTotalInside(insideRef.current.size);
  };

  // Sends the saved offline scans to the server. Returns true if the server was
  // reachable (online again), false if still offline.
  const trySync = async () => {
    if (syncingRef.current) return !offlineRef.current;
    syncingRef.current = true;
    try {
      if (loadQueue().length > 0) await syncQueue();
      setQueueCount(loadQueue().length);
      if (loadQueue().length === 0) {
        setOffline(false);
        await refreshPack(); // server's view after the sync
      }
      return true;
    } catch {
      setOffline(true);
      return false;
    } finally {
      syncingRef.current = false;
    }
  };

  // Creates the browser's sound player once and reuses it.
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  // Plays one short beep (frequency in Hz, length in seconds).
  const playTone = (freq, duration, type = "sine", delay = 0, volume = 0.25) => {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startTime = ctx.currentTime + delay;
    osc.start(startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.stop(startTime + duration + 0.02);
  };

  // Rising two-note beep for entry.
  const playEntrySound = () => {
    playTone(659.25, 0.12, "sine", 0);
    playTone(987.77, 0.16, "sine", 0.12);
  };

  // Falling two-note beep for exit.
  const playExitSound = () => {
    playTone(523.25, 0.12, "sine", 0);
    playTone(392.0, 0.18, "sine", 0.12);
  };

  // One soft short beep for "Already Scanned" (not the error buzz).
  const playNoticeSound = () => {
    playTone(587.33, 0.14, "sine", 0, 0.18);
  };

  // Shows a scan result on the card AND adds it to the "Recent scans" list.
  const showScan = (result) => {
    setScanResult(result);
    const label = result.already ? "ALREADY SCANNED"
      : result.action === "entry" ? "ENTRY"
      : result.action === "exit" ? "EXIT"
      : (result.full_name || "DENIED").toUpperCase(); // e.g. ACCESS DENIED, LIBRARY CLOSED
    const kind = result.already ? "already" : result.action === "entry" ? "entry" : result.action === "exit" ? "exit" : "error";
    const who = result.already ? (result.full_name === "Already Scanned" ? "—" : result.full_name) : (result.student_number || "—");
    setRecentResults((list) => [
      { id: `${Date.now()}-${Math.random()}`, kind, label, who, at: result.scannedAt || new Date(), offline: !!result.offline },
      ...list,
    ].slice(0, 4));
  };

  // Remembers that this QR code's entry/exit was recorded (for the 5-second rule).
  const markRecorded = (code, action, name, at) => {
    const entry = recentScansRef.current.get(code);
    if (entry) {
      entry.recordedAt = Date.now();
      entry.recorded = { action, name, at };
    }
  };

  // Low buzz for a failed scan.
  const playErrorSound = () => {
    playTone(220, 0.3, "sawtooth", 0, 0.2);
  };

  // Gets the live numbers in ONE request: students inside per college + guests inside.
  const fetchBoardData = async () => {
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/scanner/live`, {}, SCAN_TIMEOUT_MS);
      if (!response.ok) throw new Error(`live-${response.status}`);
      const data = await response.json();
      // The server answered → we're online. Send any saved offline scans first.
      if (offlineRef.current || loadQueue().length > 0) {
        trySync();
        return;
      }
      const counts = {};
      let total = 0;
      (data.colleges || []).forEach((item) => {
        const code = toAcronym(item.college);
        if (code) counts[code] = (counts[code] || 0) + item.count;
        total += item.count;
      });
      setBoardData(counts);
      setTotalInside(total);
      setGuestsInside(data.guests ?? 0);
    } catch {
      // Server unreachable → offline mode; the board is worked out on this PC.
      setOffline(true);
      showLocalBoard();
    }
  };

  // OFFLINE MODE SETUP: saves the scanner key from the address bar (?key=...),
  // downloads the student list now and every 5 minutes, and while offline keeps
  // trying to reconnect and sync every 15 seconds.
  useEffect(() => {
    // Service worker (public/scanner-sw.js): lets THIS page open even without
    // internet. Only on the live site — in development it would keep old code.
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/scanner-sw.js", { scope: "/scanner" }).catch((err) => {
        console.error("Scanner service worker failed:", err);
      });
    }
    saveScannerKeyFromUrl();
    refreshPack();
    if (loadQueue().length > 0) trySync();
    const packTimer = setInterval(() => {
      if (!offlineRef.current) refreshPack();
    }, PACK_REFRESH_MS);
    const syncTimer = setInterval(() => {
      if (offlineRef.current || loadQueue().length > 0) trySync();
    }, SYNC_RETRY_MS);
    return () => {
      clearInterval(packTimer);
      clearInterval(syncTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Asks the Scanner Agent (on this PC) if the USB scanner is plugged in.
  const fetchScannerStatus = async () => {
    try {
      const response = await fetch(`${SCANNER_AGENT_URL}/status`);
      const data = await response.json();
      if (data.connected === true) setScannerState("connected");
      else if (data.connected === false) setScannerState("disconnected");
      else setScannerState("unknown");
    } catch {
      setScannerState("unknown");
    }
  };

  // Checks the scanner now and every 5 seconds. Skipped while this tab is hidden.
  useEffect(() => {
    fetchScannerStatus();
    const scannerInterval = setInterval(() => {
      if (document.visibilityState !== "hidden") fetchScannerStatus();
    }, 5000);
    return () => clearInterval(scannerInterval);
  }, []);

  // Loads the live numbers now and every 5 seconds (skipped while the tab is hidden;
  // refreshed right away when it's visible again), and ticks the clock.
  // A scan on this screen also refreshes them immediately (see processScan).
  useEffect(() => {
    fetchBoardData();
    const boardInterval = setInterval(() => {
      if (document.visibilityState !== "hidden") fetchBoardData();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchBoardData();
        fetchScannerStatus();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(boardInterval);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // OFFLINE SCAN: checks the code against the saved student list, decides
  // entry / exit from the saved "inside" list, saves it to the queue (synced
  // later), and shows the same result screen as online.
  const handleOfflineScan = (hash, scannedAt, code) => {
    const pack = packRef.current;
    const showError = (title, message) => {
      playErrorSound();
      setStatus("error");
      showScan({ full_name: title, message, scannedAt });
    };

    if (!pack || !hash) {
      showError("Offline – Can't Verify", "No internet, and this computer has no saved student list yet. Please ask the library staff.");
      return;
    }
    const info = pack.students?.[hash];
    if (!info) {
      showError("Access Denied", "This code is not linked to an approved account.");
      return;
    }
    const [studentNumber, program] = info;
    const minutesNow = scannedAt.getHours() * 60 + scannedAt.getMinutes();
    const wasInside = insideRef.current.has(hash);

    // After 5:31 PM the server logs everyone out; mirror that here.
    if (minutesNow >= AUTO_LOGOUT_MINUTES && wasInside) {
      insideRef.current.delete(hash);
      persistInside();
      showLocalBoard();
      showError("Already Logged Out", "You were automatically logged out at 5:31 PM. The library is closed for entry.");
      return;
    }

    let action;
    if (wasInside) {
      action = "exit";
      insideRef.current.delete(hash);
    } else {
      // Same 5:30 PM entry cut-off as the server (exits still allowed).
      if (minutesNow >= ENTRY_CUTOFF_MINUTES) {
        const forcedAt = pack.forcedDate === scannedAt.toDateString() ? pack.forcedToday?.[hash] : null;
        showError(
          forcedAt ? "Already Logged Out" : "Library Closed",
          forcedAt
            ? `You were already logged out at ${forcedAt}. The library is closed for entry.`
            : "The library is closed for entry after 5:30 PM. Exits are still allowed."
        );
        return;
      }
      action = "entry";
      insideRef.current.add(hash);
    }
    persistInside();

    // Save the scan for syncing (the server re-checks it with the real time).
    const queue = loadQueue();
    queue.push({ offline_scan_id: crypto.randomUUID(), qr_hash: hash, action, scanned_at: scannedAt.toISOString() });
    saveQueue(queue);
    setQueueCount(queue.length);

    if (action === "entry") playEntrySound();
    else playExitSound();
    showScan({ action, student_number: studentNumber, program, scannedAt, offline: true });
    setStatus("ready");
    markRecorded(code, action, studentNumber, scannedAt);
    showLocalBoard();
  };

  // Sends the scanned code to the server and shows the result (entry / exit / denied).
  // If the server can't be reached, the scan is handled OFFLINE instead.
  const processScan = useCallback(async (decodedText) => {
    setIsProcessing(true);
    const scannedAt = new Date();
    const hash = await hashQr(decodedText).catch(() => null);

    // Saved offline scans must reach the server BEFORE new ones, so entries and
    // exits stay in the right order.
    let online = !offlineRef.current;
    if (loadQueue().length > 0) online = await trySync();

    if (online) {
      try {
        const response = await fetchWithTimeout(`${API_URL}/api/logs/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr_code: decodedText }),
        }, SCAN_TIMEOUT_MS);
        // Render answers 502–504 when the server itself is down → offline.
        if ([502, 503, 504].includes(response.status)) throw new Error("server-down");
        const data = await response.json();

        if (response.ok) {
          if (data.action === "entry") playEntrySound();
          else playExitSound();
          showScan({ ...data, scannedAt });
          setStatus("ready");
          // The "Already Scanned" card shows the student number only (not the name).
          markRecorded(decodedText, data.action, data.student_number, scannedAt);
          fetchBoardData();
          // Keep the saved "inside" list current, in case the internet drops next.
          if (hash) {
            if (data.action === "entry") insideRef.current.add(hash);
            else insideRef.current.delete(hash);
            persistInside();
          }
        } else if (data.duplicate) {
          // The server caught a repeat (e.g. the page was reloaded) → same calm card.
          playNoticeSound();
          setStatus("already");
          showScan({ already: true, full_name: "Already Scanned", message: data.message, scannedAt });
        } else {
          playErrorSound();
          setStatus("error");
          showScan({
            // "Already Logged Out" if the system already exited them today (5:31 PM auto
            // logout / Force Exit), "Library Closed" after the 5:30 PM cut-off,
            // otherwise "Access Denied".
            full_name: data.already_exited ? "Already Logged Out"
              : data.closed ? "Library Closed"
              : "Access Denied",
            message: data.message || "This code is not linked to an approved account.",
            scannedAt,
          });
        }
        setIsProcessing(false);
        return;
      } catch {
        // No answer (internet / server down) → handle this scan offline.
        setOffline(true);
      }
    }

    handleOfflineScan(hash, scannedAt, decodedText);
    setIsProcessing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decides what to do with a scan, using the repeat-scan rules at the top.
  // Each QR code is remembered separately, so student A never blocks student B.
  const handleScanAction = useCallback((decodedText) => {
    const now = Date.now();
    const recent = recentScansRef.current;
    setScannerState("connected"); // a scan came in, so the scanner clearly works

    // Forget codes that haven't been seen for a while (keeps the list small).
    for (const [code, entry] of recent) {
      if (now - entry.lastSeen > ALREADY_SCANNED_MS && now - (entry.recordedAt || 0) > ALREADY_SCANNED_MS) recent.delete(code);
    }

    const seen = recent.get(decodedText);
    if (seen) {
      const stillOnScanner = now - seen.lastSeen < RESTING_MS;
      seen.lastSeen = now;
      // 1) Phone still on the scanner: ignore silently (the message was already shown once).
      if (stillOnScanner) return;
      // 2) Scanned again within 5 seconds of a recorded entry/exit: "Already Scanned".
      if (seen.recorded && now - seen.recordedAt < ALREADY_SCANNED_MS) {
        const { action, name, at } = seen.recorded;
        playNoticeSound();
        setStatus("already");
        showScan({
          already: true,
          full_name: name || "Already Scanned",
          message: `Your ${action === "entry" ? "entry" : "exit"} was already recorded at ${at.toLocaleTimeString("en-US")}.`,
          scannedAt: new Date(),
        });
        return;
      }
    }

    // 3) Otherwise it's a new scan: send it.
    recent.set(decodedText, { lastSeen: now, recordedAt: 0, recorded: null });
    processScan(decodedText);
    // playNoticeSound only uses refs, so the first version is always fine to use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processScan]);

  // Listens for the USB scanner: it "types" the code quickly, then presses Enter.
  useEffect(() => {
    let buffer = "";
    const handleKeyDown = (e) => {
      const now = Date.now();
      if (now - lastKeyTimeRef.current > 300) buffer = "";
      lastKeyTimeRef.current = now;
      if (e.key === "Enter") {
        if (buffer.length > 5) handleScanAction(buffer);
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleScanAction]);

  // Clears the result after 3 seconds so the next person sees "Ready to scan".
  useEffect(() => {
    let timeout;
    if (scanResult) {
      timeout = setTimeout(() => {
        setScanResult(null);
        setStatus("searching");
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [scanResult]);

  // Which result look to use right now.
  const offline = scannerState === "disconnected";
  const kind =
    status === "error" ? "error"
    : status === "already" && scanResult ? "already"
    : scanResult ? (scanResult.action === "entry" ? "entry" : "exit")
    : offline ? "offline"
    : "waiting";
  const tone = RESULT_TONES[kind];

  // Header clock pieces.
  const pad = (n) => String(n).padStart(2, "0");
  const clock = `${pad(currentTime.getHours() % 12 || 12)}:${pad(currentTime.getMinutes())}`;
  const dateText = currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Scan frame color: gold normally, green while checking, red on error, gray when unplugged.
  const frameColor = kind === "error" ? "#B3261E" : kind === "offline" ? "#D1D5DB" : isProcessing ? BRAND.green : BRAND.gold;
  const pill = SCANNER_PILLS[scannerState];

  return (
    <div className="scanner-page h-screen w-full flex flex-col font-sans overflow-hidden" style={{ backgroundColor: BRAND.page }}>
      {/* HEADER — same as the guest pages */}
      {/* Compact header: one row so the scan area gets more space */}
      <header className="relative text-white shadow-[0_4px_16px_rgba(14,59,31,0.18)] flex-shrink-0" style={{ backgroundColor: BRAND.deep }}>
        <div className="flex items-center justify-between gap-6 px-8 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt="CvSU Logo" className="w-9 h-9 object-contain flex-shrink-0" />
            <div className="leading-tight min-w-0">
              <p className="text-[11px] text-white/60 truncate">
                Library Patron Access and Monitoring System · Entry &amp; Exit Station
              </p>
              <h1 className="text-[20px] font-bold leading-tight mt-0.5">Scan Your QR Pass</h1>
            </div>
          </div>
          {/* Right side: status pills (offline / clock / scanner), then the clock */}
          <div className="flex items-center gap-3 flex-shrink-0">
          {/* OFFLINE / SYNCING pill — hover for the full explanation */}
          {(offlineMode || queueCount > 0) && (
            <StatusPill
              dot={offlineMode ? "#F0CD5A" : "#4ADE80"}
              pulse={!offlineMode}
              label={offlineMode
                ? `Offline mode${queueCount ? ` · ${queueCount} to sync` : ""}`
                : `Syncing ${queueCount} saved ${queueCount === 1 ? "scan" : "scans"}…`}
              tip={offlineMode
                ? `Scans are saved on this computer and sent automatically when the connection returns. ${queueCount} ${queueCount === 1 ? "scan" : "scans"} waiting to sync.${
                    !getScannerKey() ? " Offline mode isn't set up on this computer (no scanner key), so students can't be verified." : !packSavedAt ? " No saved student list yet." : ""}`
                : "Connection is back. Saved offline scans are being sent to the server."}
            />
          )}
          {/* Wrong PC clock → offline scans would get the wrong time */}
          {Math.abs(clockSkewMs) > CLOCK_WARNING_MS && (
            <StatusPill
              dot="#F87171"
              label="Check PC clock"
              tip={`This computer's clock is off by about ${Math.round(Math.abs(clockSkewMs) / 60000)} minutes. Please correct it so offline scans get the right time.`}
            />
          )}
          <StatusPill dot={pill.dot} pulse={scannerState === "connected"} label={pill.text} />
          <div className="text-right ml-2">
            <p className="text-[24px] font-bold leading-none tracking-tight tabular-nums">
              {clock}
              <span className="text-[13px] text-white/50 ml-1">:{pad(currentTime.getSeconds())}</span>
              <span className="text-[13px] ml-1.5" style={{ color: BRAND.goldLight }}>
                {currentTime.getHours() < 12 ? "AM" : "PM"}
              </span>
            </p>
            <p className="text-[11px] text-white/60 mt-1">{dateText}</p>
          </div>
          </div>
        </div>
      </header>

      {/* BODY: live board on the left, scan area on the right */}
      <div className="scanner-body flex flex-1 min-h-0">
        <ScannerSideBar totalInside={totalInside} guestsInside={guestsInside} boardData={boardData} colleges={COLLEGES} />

        <main className="scanner-page-main flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-[680px] flex flex-col items-center justify-center">
            {/* Scan frame with the QR icon and a moving scan line */}
            <div className="relative w-[220px] h-[220px] flex items-center justify-center">
              {[
                "top-0 left-0 border-t-[5px] border-l-[5px] rounded-tl-2xl",
                "top-0 right-0 border-t-[5px] border-r-[5px] rounded-tr-2xl",
                "bottom-0 right-0 border-b-[5px] border-r-[5px] rounded-br-2xl",
                "bottom-0 left-0 border-b-[5px] border-l-[5px] rounded-bl-2xl",
              ].map((pos) => (
                <span key={pos} className={`absolute w-12 h-12 transition-colors duration-300 ${pos}`} style={{ borderColor: frameColor }} />
              ))}
              <QRIcon color={kind === "error" ? "#B3261E" : kind === "offline" ? "#D1D5DB" : BRAND.green} />
              {kind === "waiting" && (
                <span
                  className="scan-line absolute left-6 right-6 h-[3px] rounded-full"
                  style={{ backgroundColor: BRAND.goldLight, boxShadow: `0 0 12px ${BRAND.goldLight}` }}
                />
              )}
            </div>

            <h2 className="text-[22px] font-bold mt-7" style={{ color: kind === "offline" ? "#B3261E" : "#111827" }}>
              {isProcessing ? "Checking your pass…" : kind === "offline" ? "Scanner not connected" : "Hold your QR pass to the scanner"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {kind === "offline"
                ? "Please plug in the USB QR scanner, or ask the library staff for help."
                : "Open the QLess app and show the QR code on your Home screen."}
            </p>

            {/* LAST SCAN RESULT */}
            <div className="w-full mt-8">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.08em] mb-2 ml-1">Last scan</p>
              <div
                className="rounded-[20px] p-5 flex items-center gap-4 transition-colors duration-300 border"
                style={{
                  backgroundColor: tone.bg,
                  borderColor: kind === "waiting" ? "#EFF1EF" : tone.well,
                  boxShadow: "0 4px 16px rgba(11,31,18,0.06)",
                }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tone.well, color: tone.fg }}>
                  <ResultIcon kind={kind} />
                </div>

                <div className="scanner-result-copy flex-1 min-w-0">
                  <p className="text-[19px] font-bold truncate" style={{ color: kind === "error" || kind === "offline" ? tone.fg : kind === "waiting" ? "#9CA3AF" : "#111827" }}>
                    {kind === "waiting"
                      ? "Ready to scan"
                      : kind === "offline"
                        ? "Scanner unavailable"
                      : kind === "error"
                        ? scanResult?.full_name || "Access Denied"
                        : scanResult.full_name || scanResult.student_number}
                  </p>
                  <p className="text-[13px] text-gray-500 mt-0.5 truncate">
                    {kind === "waiting" && "The result will show here."}
                    {kind === "offline" && "Scans can't be read until the scanner is plugged back in."}
                    {kind === "error" && (scanResult?.message || "Scan could not be verified.")}
                    {kind === "already" && scanResult?.message}
                    {(kind === "entry" || kind === "exit") &&
                      (scanResult.full_name ? (
                        <>
                          {scanResult.program} · <span className="font-semibold text-gray-700">{scanResult.student_number}</span>
                        </>
                      ) : (
                        scanResult.program
                      ))}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {kind !== "waiting" && kind !== "offline" && (
                    <span className="text-[11px] font-bold tracking-wide px-3 py-1 rounded-full" style={{ backgroundColor: tone.pillBg, color: tone.pillFg }}>
                      {kind === "entry" ? "ENTRY RECORDED" : kind === "exit" ? "EXIT RECORDED" : kind === "already" ? "ALREADY SCANNED" : "DENIED"}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {scanResult?.offline && kind !== "error" ? "Saved offline · " : ""}
                    {scanResult?.scannedAt ? scanResult.scannedAt.toLocaleTimeString("en-US") : "--:--:--"}
                  </span>
                </div>
              </div>
            </div>

            {/* RECENT SCANS — the result card shows only the newest scan; these are the
                ones before it (newest first), so nobody misses their own result. */}
            {(() => {
              const earlier = scanResult ? recentResults.slice(1, 4) : recentResults.slice(0, 3);
              if (earlier.length === 0) return null;
              return (
                <div className="w-full mt-5">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.08em] mb-2 ml-1">Recent scans</p>
                  <div className="rounded-[14px] bg-white border border-[#EFF1EF] divide-y divide-[#F1F3F1]">
                    {earlier.map((item) => {
                      const t = RESULT_TONES[item.kind];
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-[12px] text-gray-400 tabular-nums w-[92px] flex-shrink-0">
                            {item.at.toLocaleTimeString("en-US")}
                          </span>
                          <span className="flex-1 min-w-0 text-[14px] font-semibold text-gray-800 tabular-nums truncate">
                            {item.who}
                            {item.offline && <span className="ml-2 text-[11px] font-medium text-gray-400">saved offline</span>}
                          </span>
                          <span className="text-[10.5px] font-bold tracking-wide px-2.5 py-0.5 rounded-full" style={{ backgroundColor: t.well, color: t.fg }}>
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </main>
      </div>

      {/* Moving scan line animation */}
      <style>{`
        @keyframes scanMove {
          0%, 100% { top: 40px; opacity: 0; }
          10%, 90% { opacity: 1; }
          50% { top: 176px; }
        }
        .scan-line { animation: scanMove 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

// Small status pill in the header. If "tip" is given, hovering shows it in a bubble below.
const StatusPill = ({ dot, label, tip, pulse = false }) => (
  <span className="relative group flex items-center gap-2 text-[12px] font-semibold bg-white/[0.12] px-3 py-1.5 rounded-full cursor-default whitespace-nowrap">
    <span className={`w-2 h-2 rounded-full ${pulse ? "animate-pulse" : ""}`} style={{ backgroundColor: dot }} />
    {label}
    {tip && (
      <span className="pointer-events-none absolute right-0 top-full mt-2 z-50 w-[280px] whitespace-normal rounded-[10px] bg-white text-gray-700 text-[12px] font-medium leading-relaxed px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
        {tip}
      </span>
    )}
  </span>
);

// Simple QR code drawing (color can change for errors).
const QRIcon = ({ color }) => (
  <svg viewBox="0 0 100 100" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="38" height="38" rx="6" fill="none" stroke={color} strokeWidth="6" />
    <rect x="15" y="15" width="18" height="18" rx="3" fill={color} />
    <rect x="57" y="5" width="38" height="38" rx="6" fill="none" stroke={color} strokeWidth="6" />
    <rect x="67" y="15" width="18" height="18" rx="3" fill={color} />
    <rect x="5" y="57" width="38" height="38" rx="6" fill="none" stroke={color} strokeWidth="6" />
    <rect x="15" y="67" width="18" height="18" rx="3" fill={color} />
    <rect x="57" y="57" width="10" height="10" rx="2" fill={color} />
    <rect x="73" y="57" width="10" height="10" rx="2" fill={color} />
    <rect x="57" y="73" width="10" height="10" rx="2" fill={color} />
    <rect x="73" y="73" width="22" height="10" rx="2" fill={color} />
    <rect x="89" y="57" width="6" height="10" rx="2" fill={color} />
  </svg>
);

// Icon inside the result card: person (waiting), log-in (entry), log-out (exit),
// X (error), unplugged warning (offline).
const ResultIcon = ({ kind }) => {
  const paths = {
    waiting: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1c0-3.3 3.6-6 8-6s8 2.7 8 6v1" />
      </>
    ),
    entry: (
      <>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </>
    ),
    exit: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
    already: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 7 12 12 15 14" />
      </>
    ),
    error: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </>
    ),
    offline: (
      <>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
  };
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[kind]}
    </svg>
  );
};

export default Scanner;