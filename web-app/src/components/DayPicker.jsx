import React, { useState, useRef, useEffect } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n) => String(n).padStart(2, "0");
// (2026, 11, 7) → "2026-11-07".
const toKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// "2026-11-17" → { year: 2026, month: 11, day: 17 }.
const parseYMD = (s) => {
  const [y, m, d] = (s || "").split("-").map(Number);
  return { year: y || null, month: m || null, day: d || null };
};

// "2026-11-17" → "November 17, 2026" (button text).
const formatLabel = (s) => {
  const { year, month, day } = parseYMD(s);
  if (!year || !month || !day) return "Select date";
  return new Date(year, month - 1, day).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
};

// (2026, 11) → "November 2026" (heading of the calendar).
const formatMonth = (y, m) => new Date(y, m - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });

// Calendar icon on the button.
const CalendarIcon = () => (
  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// Arrows for changing the month.
const ChevronLeft = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);
const ChevronRight = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

// Day picker: a button that opens a small calendar with a month switcher.
// Same look as MonthPicker.
//   value = "YYYY-MM-DD", max = latest day allowed ("YYYY-MM-DD"),
//   onChange({ target: { value } }).
const DayPicker = ({ value, onChange, max, className = "" }) => {
  const [open, setOpen] = useState(false);
  const sel = parseYMD(value);
  const now = new Date();
  const todayKey = toKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
  // The month currently shown in the calendar.
  const [view, setView] = useState({ year: sel.year || now.getFullYear(), month: sel.month || now.getMonth() + 1 });
  const rootRef = useRef(null);
  const maxP = parseYMD(max);

  // When opening, show the month of the selected day.
  useEffect(() => {
    if (open) setView({ year: sel.year || now.getFullYear(), month: sel.month || now.getMonth() + 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Closes the picker when clicking anywhere else.
  useEffect(() => {
    const handler = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Days after "max" (future days) can't be picked.
  const isDayDisabled = (d) => (max ? toKey(view.year, view.month, d) > max : false);

  // Can't go to a month after the latest allowed one.
  const nextDisabled = maxP.year
    ? view.year > maxP.year || (view.year === maxP.year && view.month >= maxP.month)
    : false;

  // Moves the calendar by one month (-1 = earlier, +1 = later).
  const shiftMonth = (delta) =>
    setView((v) => {
      const d = new Date(v.year, v.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

  // Picks a day and closes the picker.
  const pick = (d) => {
    onChange({ target: { value: toKey(view.year, view.month, d) } });
    setOpen(false);
  };

  // "Today" shortcut.
  const jumpToday = () => {
    if (max && todayKey > max) return;
    onChange({ target: { value: todayKey } });
    setOpen(false);
  };

  // Blank cells before the 1st, then 1..last day of the shown month.
  const firstWeekday = new Date(view.year, view.month - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(view.year, view.month, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-[8px] bg-white text-sm font-medium text-gray-700 border border-[#E3E7E3] outline-none focus:ring-4 focus:ring-[#1B5E20]/10 transition cursor-pointer"
      >
        {formatLabel(value)}
        <CalendarIcon />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 right-0 bg-white rounded-[12px] shadow-md p-3 w-[280px]">
          <div className="flex items-center justify-between mb-2 px-1">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1 rounded-full hover:bg-[#F7F8F7] text-gray-500 transition-colors">
              <ChevronLeft />
            </button>
            <span className="text-sm font-semibold text-gray-700">{formatMonth(view.year, view.month)}</span>
            <button
              type="button"
              onClick={() => !nextDisabled && shiftMonth(1)}
              disabled={nextDisabled}
              className={`p-1 rounded-full text-gray-500 transition-colors ${nextDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-[#F7F8F7]"}`}
            >
              <ChevronRight />
            </button>
          </div>

          {/* Su Mo Tu We Th Fr Sa */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[11px] font-semibold text-gray-400 text-center py-1">{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <span key={`blank-${i}`} />;
              const key = toKey(view.year, view.month, d);
              const disabled = isDayDisabled(d);
              const isSelected = key === value;
              const isToday = key === todayKey;
              return (
                <button
                  type="button"
                  key={key}
                  disabled={disabled}
                  onClick={() => pick(d)}
                  className={`h-8 rounded-full text-xs font-semibold transition-colors ${
                    isSelected
                      ? "bg-[#1B5E20] text-white"
                      : disabled
                      ? "text-gray-300 cursor-not-allowed"
                      : isToday
                      ? "text-[#1B5E20] ring-1 ring-[#1B5E20]/40 hover:bg-[#E8F1E9]"
                      : "text-gray-600 hover:bg-[#E8F1E9] hover:text-[#1B5E20]"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-2 border-t border-[#F1F3F1] flex justify-end">
            <button type="button" onClick={jumpToday} className="text-xs font-semibold text-[#1B5E20] hover:underline">
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayPicker;