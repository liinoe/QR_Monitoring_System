import React, { useEffect, useState, useRef, useCallback } from "react";
import ScannerSideBar from "../../components/ScannerSideBar";
import logo from "../../assets/cvsu_logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
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
  const lastScanRef = useRef({ code: null, time: 0 });

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

  // Low buzz for a failed scan.
  const playErrorSound = () => {
    playTone(220, 0.3, "sawtooth", 0, 0.2);
  };

  // Gets the live numbers in ONE request: students inside per college + guests inside.
  const fetchBoardData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/scanner/live`);
      const data = await response.json();
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
    } catch (err) {
      console.error("Board fetch error:", err);
    }
  };

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

  // Sends the scanned code to the server and shows the result (entry / exit / denied).
  const processScan = useCallback(async (decodedText) => {
    setIsProcessing(true);
    const scannedAt = new Date();

    try {
      const response = await fetch(`${API_URL}/api/logs/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_code: decodedText }),
      });
      const data = await response.json();

      if (response.ok) {
        if (data.action === "entry") playEntrySound();
        else playExitSound();
        setScanResult({ ...data, scannedAt });
        setStatus("ready");
        fetchBoardData();
      } else {
        playErrorSound();
        setStatus("error");
        setScanResult({
          // "Library Closed" when it's past the 5:30 PM entry cut-off, otherwise "Access Denied".
          full_name: data.closed ? "Library Closed" : "Access Denied",
          message: data.message || "This code is not linked to an approved account.",
          scannedAt,
        });
      }
    } catch (err) {
      playErrorSound();
      setStatus("error");
      setScanResult({ full_name: "Connection Error", message: "Cannot reach the server.", scannedAt });
    }

    setIsProcessing(false);
  }, []);

  // Ignores the same code scanned twice within 0.8s (scanner "bounce").
  const handleScanAction = useCallback((decodedText) => {
    const now = Date.now();
    const isBounce = decodedText === lastScanRef.current.code && now - lastScanRef.current.time < 800;
    if (isBounce) return;
    lastScanRef.current = { code: decodedText, time: now };
    setScannerState("connected"); // a scan came in, so the scanner clearly works
    processScan(decodedText);
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
      <header className="relative text-white shadow-[0_4px_16px_rgba(14,59,31,0.18)] flex-shrink-0" style={{ backgroundColor: BRAND.deep }}>
        <div className="flex items-center gap-3 px-8 pt-5">
          <img src={logo} alt="CvSU Logo" className="w-9 h-9 object-contain" />
          <div className="leading-tight">
            <p className="text-[13px] font-extrabold tracking-wide">Library Patron Access and Monitoring System</p>
            <p className="text-[11px] text-white/60">Ladislao N. Diwa Memorial Library</p>
          </div>
        </div>
        <div className="flex items-end justify-between gap-6 px-8 pt-5 pb-6">
          <div>
            <p className="text-[13px] text-white/70 font-medium">Entry &amp; Exit Station</p>
            <div className="flex items-center gap-3 mt-0.5">
              <h1 className="text-[28px] font-bold leading-tight">Scan Your QR Pass</h1>
              {/* Scanner connection pill */}
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold bg-white/[0.12] px-3 py-1 rounded-full">
                <span
                  className={`w-2 h-2 rounded-full ${scannerState === "connected" ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: pill.dot }}
                />
                {pill.text}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[34px] font-bold leading-none tracking-tight tabular-nums">
              {clock}
              <span className="text-[16px] text-white/50 ml-1">:{pad(currentTime.getSeconds())}</span>
              <span className="text-[16px] ml-2" style={{ color: BRAND.goldLight }}>
                {currentTime.getHours() < 12 ? "AM" : "PM"}
              </span>
            </p>
            <p className="text-[12px] text-white/60 mt-1.5">{dateText}</p>
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
                      {kind === "entry" ? "ENTRY RECORDED" : kind === "exit" ? "EXIT RECORDED" : "DENIED"}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {scanResult?.scannedAt ? scanResult.scannedAt.toLocaleTimeString("en-US") : "--:--:--"}
                  </span>
                </div>
              </div>
            </div>
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