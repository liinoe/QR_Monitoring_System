import React from "react";

// Left panel of the scanner kiosk: who's inside right now + the live board per college.
// Same look as the mobile app: white rounded cards with soft shadows.
const ScannerSideBar = ({ totalInside, guestsInside = 0, boardData = {}, colleges }) => {
  return (
    <aside className="scanner-sidebar w-[360px] flex-shrink-0 p-6 space-y-6 overflow-y-auto">
      {/* STUDENTS + GUESTS INSIDE */}
      <div>
        <SectionLabel>Inside the library</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Students" value={totalInside} fg="#1B5E20" />
          <StatCard label="Guests" value={guestsInside} fg="#946800" />
        </div>
      </div>

      {/* LIVE BOARD */}
      <div>
        <div className="flex items-center justify-between">
          <SectionLabel>Live visitor board</SectionLabel>
          <LiveDot />
        </div>
        {/* 2 per row, A–Z */}
        <div className="grid grid-cols-2 gap-2.5">
          {[...colleges].sort((a, b) => a.id.localeCompare(b.id)).map((item) => (
            <CollegeTile key={item.id} item={item} count={boardData[item.id] ?? 0} total={totalInside} />
          ))}
        </div>
      </div>
    </aside>
  );
};

// Small gray uppercase heading (like "ACCOUNT DETAILS" in the app).
const SectionLabel = ({ children }) => (
  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.08em] mb-2.5 ml-1">{children}</p>
);

// Pulsing green dot + "Live" — shows the numbers update by themselves.
const LiveDot = () => (
  <span className="flex items-center gap-1.5 mb-2.5 text-[10.5px] font-bold text-[#1B5E20] bg-[#E8F1E9] px-2 py-0.5 rounded-full">
    <span className="w-1.5 h-1.5 rounded-full bg-[#1B5E20] animate-pulse" />
    LIVE
  </span>
);

// White card with a big centered number and a label.
const StatCard = ({ label, value, fg }) => (
  <div className="bg-white rounded-[20px] shadow-[0_4px_16px_rgba(11,31,18,0.06)] py-5 flex flex-col items-center justify-center text-center">
    <p className="text-[40px] font-extrabold leading-none tabular-nums" style={{ color: fg }}>{value}</p>
    <p className="text-xs font-semibold text-gray-500 mt-2">{label}</p>
  </div>
);

// One college on the live board: big count, college code, and a thin bar
// showing that college's share of all students inside.
const CollegeTile = ({ item, count, total }) => {
  const active = count > 0;
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="bg-white rounded-[14px] shadow-[0_2px_10px_rgba(11,31,18,0.05)] px-2 pt-3 pb-2.5 flex flex-col items-center text-center">
      <span className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: active ? item.color : "#C4C8C5" }}>
        {count}
      </span>
      <span className="text-[11px] font-bold text-gray-600 tracking-wide mt-1.5">{item.id}</span>
      <div className="w-full h-1 rounded-full bg-[#F1F3F1] mt-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share}%`, backgroundColor: item.color }} />
      </div>
    </div>
  );
};

export default ScannerSideBar;