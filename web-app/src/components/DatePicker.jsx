import React, { useState, useRef, useEffect } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const POPUP_HEIGHT = 360; // px, used to decide whether to open above or below

// Date → "YYYY-MM-DD" (local date, no timezone shift).
const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// "YYYY-MM-DD" → Date at local midnight.
const fromYMD = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// "2026-08-10" → "Aug 10, 2026" (button text).
const formatLabel = (ymd) =>
  fromYMD(ymd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Calendar icon on the button.
const CalendarIcon = () => (
  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// Left / right arrow for changing the month.
const Arrow = ({ dir }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points={dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
  </svg>
);

// Date picker in the system's style (replaces the browser's <input type="date">).
//   value / onChange(value)   "YYYY-MM-DD" strings ("" = nothing picked)
//   min / max                 days outside this range can't be picked
//   rangeStart / rangeEnd     optional: days between them get a light green band
//   disabled, placeholder
const DatePicker = ({ value, onChange, min, max, rangeStart, rangeEnd, disabled = false, placeholder = "Pick a date" }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => fromYMD(value || toYMD(new Date())));
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const today = toYMD(new Date());

  // When opening, jump to the selected month (or this month).
  useEffect(() => {
    if (open) setView(fromYMD(value || (min && min > today ? min : today)));
  }, [open]);

  // Closes the picker when clicking anywhere else.
  useEffect(() => {
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Opens below the button, or above it if there's no room below.
  const toggle = () => {
    if (disabled) return;
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      const up = window.innerHeight - r.bottom < POPUP_HEIGHT + 16 && r.top > window.innerHeight - r.bottom;
      setPos({ left: Math.min(r.left, window.innerWidth - 296), ...(up ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }) });
    }
    setOpen((o) => !o);
  };

  // Moves the calendar one month back or forward.
  const shiftMonth = (n) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));

  // Picks a day and closes the picker.
  const pick = (ymd) => {
    onChange(ymd);
    setOpen(false);
  };

  // True if a day can't be picked (before min / after max).
  const isBlocked = (ymd) => (min && ymd < min) || (max && ymd > max);

  // The 6×7 grid of days shown for the current month (with the edges of the next/previous months).
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 pl-3.5 pr-3 py-2.5 rounded-[8px] border text-sm text-left outline-none transition
          ${open ? "border-[#1B5E20] ring-4 ring-[#1B5E20]/10" : "border-[#E3E7E3]"}
          ${disabled ? "bg-[#F4F5F4] text-gray-400 cursor-not-allowed" : "bg-white text-gray-800 cursor-pointer"}`}
      >
        <span className={value ? "font-medium" : "text-gray-400"}>{value ? formatLabel(value) : placeholder}</span>
        <CalendarIcon />
      </button>

      {open && pos && (
        <div
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom }}
          className="z-[60] w-[288px] bg-white rounded-[12px] border border-[#ECEFEC] shadow-md p-4"
        >
          {/* Month + arrows */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-[#E8F1E9] hover:text-[#1B5E20] transition-colors">
              <Arrow dir="left" />
            </button>
            <span className="text-sm font-bold text-gray-900">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
            <button type="button" onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-[#E8F1E9] hover:text-[#1B5E20] transition-colors">
              <Arrow dir="right" />
            </button>
          </div>

          {/* Weekday names */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-center text-[11px] font-bold text-gray-400 uppercase">{d}</span>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((d) => {
              const ymd = toYMD(d);
              const inMonth = d.getMonth() === view.getMonth();
              const selected = ymd === value;
              const blocked = isBlocked(ymd);
              const isToday = ymd === today;
              const inRange = rangeStart && rangeEnd && ymd > rangeStart && ymd < rangeEnd;
              return (
                <div key={ymd} className={`flex justify-center ${inRange ? "bg-[#E8F1E9]" : ""}`}>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => pick(ymd)}
                    className={`w-9 h-9 rounded-full text-[13px] transition-colors tabular-nums
                      ${selected ? "bg-[#1B5E20] text-white font-bold" : ""}
                      ${!selected && isToday ? "ring-2 ring-[#D4A62A] font-bold text-gray-900" : ""}
                      ${!selected && !blocked ? "hover:bg-[#E8F1E9] hover:text-[#1B5E20]" : ""}
                      ${!selected && !isToday ? (inMonth ? "text-gray-700" : "text-gray-300") : ""}
                      ${blocked ? "opacity-30 cursor-not-allowed" : ""}`}
                  >
                    {d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Shortcuts */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F1F3F1]">
            <button type="button" onClick={() => pick("")} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
              Clear
            </button>
            <button
              type="button"
              disabled={isBlocked(today)}
              onClick={() => pick(today)}
              className="text-xs font-semibold text-[#1B5E20] hover:underline disabled:opacity-30 disabled:no-underline"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;