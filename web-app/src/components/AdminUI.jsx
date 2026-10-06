import React from "react";
import { createPortal } from "react-dom";
import HoverTooltip from "./HoverTooltip";

// Shared building blocks for the admin pages, so they look like the
// QLess mobile app, the guest kiosk and the scanner:
// flat white cards, big rounded corners, small gray uppercase labels,
// mint/gold accents and pill-shaped badges.

// Colors copied from the mobile app (qless-ui/src/theme/brand.js).
export const BRAND = {
  deep: "#0E3B1F",
  green: "#1B5E20",
  gold: "#D4A62A",
  goldText: "#946800",
  goldSoft: "#FBF3DC",
  mint: "#E8F1E9",
  red: "#B3261E",
  redSoft: "#FBDFDB",
  page: "#F7F8F7",
};

// One color per college — same colors as the scanner's live board.
// COM and CAPS use teal / indigo until they have official colors.
export const COLLEGE_COLORS = {
  CAFENR: "#16a34a",
  CAPS: "#4338ca",
  CAS: "#ca8a04",
  CCJ: "#9333ea",
  CED: "#2563eb",
  CEIT: "#ea580c",
  CEMDS: "#ef4444",
  COM: "#0d9488",
  CON: "#dc2626",
  CSPEAR: "#7f1d1d",
  CTHM: "#f97316",
  CVMBS: "#ec4899",
};

// White card with a thin border and rounded corners.
export const Card = ({ className = "", children }) => (
  <div className={`bg-white rounded-[20px] border border-[#ECEFEC] ${className}`}>{children}</div>
);

// Card title + optional small gray note on the right or below.
export const CardTitle = ({ title, note, right }) => (
  <div className="flex items-start justify-between gap-4 mb-4">
    <div>
      <p className="text-[15px] font-bold text-gray-900">{title}</p>
      {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
    </div>
    {right}
  </div>
);

// Small gray uppercase heading (like "ACCOUNT DETAILS" in the app).
export const SectionLabel = ({ children }) => (
  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.08em] mb-2 ml-1">{children}</p>
);

// Rounded badge. tone: 'green' | 'gold' | 'red' | 'gray'.
export const Pill = ({ tone = "gray", children, dot = false }) => {
  const tones = {
    green: { bg: BRAND.mint, fg: BRAND.green },
    gold: { bg: "#FBF1CE", fg: BRAND.goldText },
    red: { bg: BRAND.redSoft, fg: BRAND.red },
    gray: { bg: "#F1F3F1", fg: "#6B7280" },
  };
  const t = tones[tone] || tones.gray;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: t.fg }} />}
      {children}
    </span>
  );
};

// Little "i" icon that shows an explanation when hovered.
export const InfoTip = ({ text }) => (
  <HoverTooltip label={text}>
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help transition-colors">
      <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
    </svg>
  </HoverTooltip>
);

// KPI card: label, big number, and a small line under it.
//   color   color of the big number
//   footer  a Pill or short text under the number
//   tooltip explanation shown on the "i" icon
export const KpiCard = ({ label, value, unit, color = "#111827", footer, tooltip }) => (
  <Card className="p-5 flex flex-col">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[12.5px] font-semibold text-gray-500">{label}</p>
      {tooltip && <InfoTip text={tooltip} />}
    </div>
    <p className="text-[36px] font-extrabold leading-none mt-3 tabular-nums" style={{ color }}>
      {value}
      {unit && <span className="text-[16px] font-bold text-gray-400 ml-1">{unit}</span>}
    </p>
    <div className="mt-3 min-h-[24px] flex items-center">{footer}</div>
  </Card>
);

// "↑ 12% vs yesterday" style pill: green when up, red when down, gray when no data.
export const TrendPill = ({ change, suffix, emptyText }) => {
  if (change === null || change === undefined) return <span className="text-xs text-gray-400">{emptyText}</span>;
  const up = change >= 0;
  return (
    <Pill tone={up ? "green" : "red"}>
      {up ? "↑" : "↓"} {suffix}
    </Pill>
  );
};

// Chart hover box in the same style as the cards (used by Recharts <Tooltip content={...} />).
export const ChartTooltip = ({ active, payload, label, unit = "" }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-[12px] bg-[#0E3B1F] text-white text-xs px-3 py-2 shadow-xl">
      <p className="font-semibold">{label || item.name}</p>
      <p className="text-white/80 mt-0.5">
        {item.value} {unit}
      </p>
    </div>
  );
};

// Circle with someone's initials (mint for students, gold for guests).
export const Avatar = ({ name, guest = false }) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const initials = parts.length === 0
    ? "?"
    : /^\d+$/.test(parts[0])
      ? parts[0].slice(-2) // student numbers: last 2 digits
      : `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
  return (
    <div
      className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[13px] font-extrabold flex-shrink-0"
      style={guest ? { backgroundColor: BRAND.goldSoft, color: BRAND.goldText } : { backgroundColor: BRAND.mint, color: BRAND.green }}
    >
      {initials}
    </div>
  );
};

// "Time Out" table cell (replaces the old Status column):
//   still inside      → green "Inside" pill
//   left normally     → the exit time
//   forced exit       → the exit time + gray "Auto" tag (5:31 PM auto-logout or
//                       "Force Exit All"; these don't count toward average stay)
export const TimeOutCell = ({ inside, time, forced }) => {
  if (inside) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E8F1E9] text-[#1B5E20]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1B5E20] animate-pulse" />
        Inside
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-gray-600 tabular-nums">
      {time || "—"}
      {forced && (
        <HoverTooltip label="Forced exit (5:31 PM auto-logout or Force Exit All). Not counted in the average stay.">
          <span className="px-2 py-0.5 rounded-full bg-[#F1F3F1] text-gray-500 text-[10px] font-bold cursor-help">Auto</span>
        </HoverTooltip>
      )}
    </span>
  );
};

// Centered gray message for empty lists/charts.
export const EmptyState = ({ text }) => (
  <div className="h-full min-h-[160px] flex items-center justify-center text-sm text-gray-400">{text}</div>
);

// ---------------------------------------------------------------------------
// Buttons and pop-ups (used by Student Logs, Guest Logs, ...)
// ---------------------------------------------------------------------------

// Shared button styles (same shapes as the guest kiosk buttons).
export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 bg-[#1B5E20] hover:bg-[#164a1a] text-white text-sm font-semibold px-5 py-2.5 rounded-[12px] transition-colors disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 bg-[#E8F1E9] hover:bg-[#dbe9dc] text-[#1B5E20] text-sm font-semibold px-5 py-2.5 rounded-[12px] transition-colors disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 bg-[#B3261E] hover:bg-[#9a2019] text-white text-sm font-semibold px-5 py-2.5 rounded-[12px] transition-colors disabled:opacity-60",
  dangerSoft:
    "inline-flex items-center justify-center gap-2 bg-[#FBDFDB] hover:bg-[#f7cdc7] text-[#B3261E] text-sm font-semibold px-4 py-2.5 rounded-[12px] transition-colors disabled:opacity-60",
};

// Page title row: big title, gray subtitle, and optional buttons on the right.
export const PageTitle = ({ title, subtitle, right }) => (
  <div className="flex items-end justify-between gap-4 flex-wrap">
    <div>
      <h1 className="text-[26px] font-bold text-gray-900 leading-tight">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
    {right && <div className="flex items-center gap-3">{right}</div>}
  </div>
);

// Search box, tabs, dropdown and month picker: use the restyled
// SearchInput, FilterTabs, FilterSelect and MonthPicker components.

// Thin vertical line between filter groups.
export const FilterDivider = () => <div className="h-6 w-px bg-gray-300 mx-1" />;

// Colors per pop-up type (same tones as the guest kiosk and the app's AppDialog).
const DIALOG_TONES = {
  success: { fg: BRAND.green, bg: BRAND.mint, icon: <polyline points="8 12 11 15 16 9" /> },
  warning: { fg: BRAND.goldText, bg: "#FBF1CE", icon: <><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></> },
  error: { fg: BRAND.red, bg: BRAND.redSoft, icon: <><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></> },
};

// Centered pop-up with a blurred background (replaces window.confirm / alert).
//   tone     'success' | 'warning' | 'error'
//   footer   the buttons row
export const Dialog = ({ open, tone = "warning", title, message, footer }) => {
  if (!open) return null;
  const t = DIALOG_TONES[tone] || DIALOG_TONES.warning;
  // Drawn straight into <body> (portal) so it always covers the whole page,
  // even when it's opened from inside the sidebar or the sticky header.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#071A0F]/40 backdrop-blur-sm">
      <div className="w-full max-w-[420px] bg-white rounded-[24px] shadow-2xl p-7">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: t.bg, color: t.fg }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              {t.icon}
            </svg>
          </div>
          <h3 className="text-[19px] font-bold text-gray-900">{title}</h3>
          {message && <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{message}</p>}
        </div>
        {footer && <div className="mt-6 flex gap-3 [&>*]:flex-1">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

// Registration status badge (Registrations table + student details pop-up).
//   status: pending | pending renewal | approved | rejected | deactivated | expired / unapproved
const REG_STATUS_STYLES = {
  pending: { bg: "#FBF1CE", fg: "#946800", label: "Pending" },
  "pending renewal": { bg: "#FDE7D6", fg: "#B4540A", label: "Pending Renewal" },
  approved: { bg: "#E8F1E9", fg: "#1B5E20", label: "Approved" },
  rejected: { bg: "#FBDFDB", fg: "#B3261E", label: "Rejected" },
  deactivated: { bg: "#F1F3F1", fg: "#4B5563", label: "Deactivated" },
  expired: { bg: "#F1F3F1", fg: "#4B5563", label: "Semester Ended" }, // pass expired when the semester ended
  "expired / unapproved": { bg: "#F1F3F1", fg: "#6B7280", label: "Not Reviewed" }, // old pending request nobody answered
};

// Colored pill with a friendly label, e.g. "pending renewal" → "Pending Renewal".
export const RegStatusPill = ({ status }) => {
  const t = REG_STATUS_STYLES[status] || { bg: "#F1F3F1", fg: "#6B7280", label: status || "—" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      {t.label}
    </span>
  );
};
