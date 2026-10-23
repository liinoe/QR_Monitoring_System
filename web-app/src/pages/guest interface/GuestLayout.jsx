import React, { useState, useEffect } from "react";
import logo from "../../assets/cvsu_logo.png";

// Shared look for every guest (kiosk) page, matching the QLess mobile app:
// deep green header, soft white cards, mint icon circles and gold accents.

// Colors copied from the mobile app (qless-ui/src/theme/brand.js).
export const BRAND = {
  deep: "#0E3B1F",      // headers
  green: "#1B5E20",     // buttons / primary
  gold: "#D4A62A",
  goldLight: "#F0CD5A",
  goldSoft: "#FBF3DC",
  mint: "#E8F1E9",      // soft icon backgrounds
  page: "#F7F8F7",      // page background (same as the app)
};

// Small outline icons (same style as the app's Ionicons "outline" set).
const ICON_PATHS = {
  back: <path d="M15 18l-6-6 6-6" />,
  login: (
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  arrow: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 11 15 16 9" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  chevron: <polyline points="6 9 12 15 18 9" />,
  people: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
};

// Draws one of the icons above. Color follows the text color (currentColor).
export const Icon = ({ name, size = 20, strokeWidth = 2, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {ICON_PATHS[name]}
  </svg>
);

// Gold corner brackets around something (the app's "QR scan" frame).
export const ScanFrame = ({ size = 64, arm = 16, children }) => {
  const corner = "absolute border-[#D4A62A]";
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <span className={`${corner} top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg`} style={{ width: arm, height: arm }} />
      <span className={`${corner} top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg`} style={{ width: arm, height: arm }} />
      <span className={`${corner} bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg`} style={{ width: arm, height: arm }} />
      <span className={`${corner} bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg`} style={{ width: arm, height: arm }} />
      {children}
    </div>
  );
};

// "Good morning" / "Good afternoon" / "Good evening" based on the hour.
export const getGreeting = (date) => {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

// Keeps a Date that updates every second (for the header clock).
export const useNow = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

// Page frame: light background + deep green header.
//   title     big text in the header (e.g. "Guest Entry")
//   subtitle  small text after the system name, above the title
//   onBack    if given, shows a white "Back" button on the left
export const GuestLayout = ({ title, subtitle, onBack, children }) => {
  const now = useNow();
  const pad = (n) => String(n).padStart(2, "0");
  const hours12 = now.getHours() % 12 || 12;
  const time = `${pad(hours12)}:${pad(now.getMinutes())}`;
  const seconds = pad(now.getSeconds());
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen w-full font-sans flex flex-col" style={{ backgroundColor: BRAND.page }}>
      {/* HEADER */}
      {/* Compact header: one row so the form gets more space */}
      <header
        className="relative text-white shadow-[0_4px_16px_rgba(14,59,31,0.18)] flex-shrink-0"
        style={{ backgroundColor: BRAND.deep }}
      >
        <div className="relative flex items-center justify-between gap-6 px-8 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                aria-label="Back"
                className="w-9 h-9 rounded-full bg-white/[0.12] hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Icon name="back" size={18} />
              </button>
            )}
            <img src={logo} alt="CvSU Logo" className="w-9 h-9 object-contain flex-shrink-0" />
            <div className="leading-tight min-w-0">
              <p className="text-[11px] text-white/60 truncate">
                Library Patron Access and Monitoring System{subtitle ? ` · ${subtitle}` : ""}
              </p>
              <h1 className="text-[20px] font-bold leading-tight mt-0.5 truncate">{title}</h1>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-[24px] font-bold leading-none tracking-tight tabular-nums">
              {time}
              <span className="text-[13px] text-white/50 ml-1">:{seconds}</span>
              <span className="text-[13px] ml-1.5" style={{ color: BRAND.goldLight }}>
                {now.getHours() < 12 ? "AM" : "PM"}
              </span>
            </p>
            <p className="text-[11px] text-white/60 mt-1">{date}</p>
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main className="flex-1 flex justify-center px-6 py-8">{children}</main>
    </div>
  );
};

// White card with the app's soft shadow and big rounded corners.
export const Card = ({ className = "", children }) => (
  <div className={`bg-white rounded-[12px] border border-[#E4E4E7] ${className}`}>{children}</div>
);

// Small gray uppercase heading above a card (like "ACCOUNT DETAILS" in the app).
export const SectionLabel = ({ children }) => (
  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.08em] mb-2 ml-1">{children}</p>
);

// Colors for each dialog type (same tones as the app's AppDialog).
const TONES = {
  success: { icon: "check", fg: "#1B5E20", bg: "#E8F1E9" },
  warning: { icon: "alert", fg: "#946800", bg: "#FBF1CE" },
  error: { icon: "alert", fg: "#B3261E", bg: "#FBDFDB" },
  info: { icon: "logout", fg: "#1B5E20", bg: "#E8F1E9" },
};

// Centered pop-up with a blurred background, like the app's AppDialog.
//   tone     'success' | 'warning' | 'error' | 'info'
//   footer   the buttons row
export const Dialog = ({ open, tone = "info", title, message, children, footer, maxWidth = 440 }) => {
  if (!open) return null;
  const t = TONES[tone] || TONES.info;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#071A0F]/40 backdrop-blur-sm">
      <div
        className="w-full bg-white rounded-[12px] shadow-lg p-7 animate-[fadeIn_0.2s_ease-out]"
        style={{ maxWidth }}
      >
        <div className="flex flex-col">
          <h3 className="text-[19px] font-bold" style={{ color: tone === "error" || tone === "warning" ? t.fg : "#111827" }}>{title}</h3>
          {message && <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{message}</p>}
        </div>
        {children && <div className="mt-5">{children}</div>}
        {footer && <div className="mt-6 flex gap-3">{footer}</div>}
      </div>
    </div>
  );
};

// Button styles shared by all guest pages.
export const btn = {
  primary:
    "flex-1 inline-flex items-center justify-center gap-2 bg-[#1B5E20] hover:bg-[#164a1a] text-white font-semibold py-3.5 px-6 rounded-[8px] transition-colors disabled:opacity-60",
  secondary:
    "flex-1 inline-flex items-center justify-center gap-2 bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] text-gray-800 font-semibold py-3.5 px-6 rounded-[8px] transition-colors disabled:opacity-60",
  danger:
    "flex-1 inline-flex items-center justify-center gap-2 bg-[#B3261E] hover:bg-[#9a2019] text-white font-semibold py-3.5 px-6 rounded-[8px] transition-colors disabled:opacity-60",
};

// Text input style shared by all guest pages.
export const inputClass =
  "w-full bg-white border border-[#E3E7E3] rounded-[8px] px-4 py-3 text-[15px] text-gray-800 placeholder:text-gray-400 outline-none transition focus:border-[#1B5E20] focus:ring-4 focus:ring-[#1B5E20]/10";

export default GuestLayout;