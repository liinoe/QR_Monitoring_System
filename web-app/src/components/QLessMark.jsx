import React from "react";

// QLess logo for the website — same drawing as the mobile app's logo
// (qless-ui/src/components/QLessLogo.js): scan corners + magnifier "Q" + open book.
//   size   width/height in px
//   tone   "dark"  = for dark green backgrounds (gold Q, white book/corners)
//          "light" = for white backgrounds (gold→green Q, green book, dark corners)
const TONES = {
  dark: { from: "#F0CD5A", to: "#C99A22", book: "#FFFFFF", bracket: "rgba(255,255,255,0.92)" },
  light: { from: "#D9AC2E", to: "#3F6A22", book: "#1B5E20", bracket: "#0E3B1F" },
};

const BRACKETS = ["M10 32 L10 10 L32 10", "M88 10 L110 10 L110 32", "M110 88 L110 110 L88 110", "M32 110 L10 110 L10 88"];

const QLessMark = ({ size = 32, tone = "dark", className = "" }) => {
  const t = TONES[tone] || TONES.dark;
  const gradId = `qless-grad-${tone}`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-label="QLess logo" role="img">
      <defs>
        <linearGradient id={gradId} x1="26" y1="24" x2="92" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>
      {BRACKETS.map((d) => (
        <path key={d} d={d} fill="none" stroke={t.bracket} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <g transform="translate(-7.67 -7.41) scale(1.13)">
        <circle cx="54" cy="52" r="24" fill="none" stroke={`url(#${gradId})`} strokeWidth="9" />
        <line x1="71" y1="69" x2="88" y2="86" stroke={`url(#${gradId})`} strokeWidth="10" strokeLinecap="round" />
        <path d="M52.8 46.2 C48.6 42.4 44.6 41.2 40.5 41.8 L40.5 61.8 C44.6 61.3 48.6 62.4 52.8 65.4 Z" fill={t.book} />
        <path d="M55.2 46.2 C59.4 42.4 63.4 41.2 67.5 41.8 L67.5 61.8 C63.4 61.3 59.4 62.4 55.2 65.4 Z" fill={t.book} />
      </g>
    </svg>
  );
};

export default QLessMark;
