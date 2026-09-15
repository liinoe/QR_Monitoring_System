import React, { useState, useRef, useEffect } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseYM = (ym) => {
  const [y, m] = (ym || "").split("-").map(Number);
  return { year: y || null, month: m || null };
};

const formatLabel = (ym) => {
  const { year, month } = parseYM(ym);
  if (!year || !month) return "Select month";
  return new Date(year, month - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });
};

const CalendarIcon = () => (
  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ChevronLeft = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);
const ChevronRight = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

const MonthPicker = ({ value, onChange, max, className = "" }) => {
  const [open, setOpen] = useState(false);
  const { year: selYear, month: selMonth } = parseYM(value);
  const [viewYear, setViewYear] = useState(selYear || new Date().getFullYear());
  const rootRef = useRef(null);
  const { year: maxYear, month: maxMonth } = parseYM(max);

  useEffect(() => {
    if (open) setViewYear(selYear || new Date().getFullYear());
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isMonthDisabled = (m) => {
    if (!maxYear) return false;
    if (viewYear > maxYear) return true;
    if (viewYear === maxYear && m > maxMonth) return true;
    return false;
  };

  const isYearNextDisabled = maxYear ? viewYear >= maxYear : false;

  const pick = (m) => {
    const mm = String(m).padStart(2, "0");
    onChange({ target: { value: `${viewYear}-${mm}` } });
    setOpen(false);
  };

  const jumpThisMonth = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    onChange({ target: { value: `${now.getFullYear()}-${mm}` } });
    setViewYear(now.getFullYear());
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-gray-200 pl-4 pr-3 py-2 rounded-lg bg-white text-sm text-gray-700 outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 hover:border-gray-300 transition-colors cursor-pointer"
      >
        {formatLabel(value)}
        <CalendarIcon />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-[240px]">
          <div className="flex items-center justify-between mb-2 px-1">
            <button type="button" onClick={() => setViewYear((y) => y - 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronLeft />
            </button>
            <span className="text-sm font-semibold text-gray-700">{viewYear}</span>
            <button
              type="button"
              onClick={() => !isYearNextDisabled && setViewYear((y) => y + 1)}
              disabled={isYearNextDisabled}
              className={`p-1 rounded text-gray-500 transition-colors ${isYearNextDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-100"}`}
            >
              <ChevronRight />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS.map((label, i) => {
              const m = i + 1;
              const disabled = isMonthDisabled(m);
              const isSelected = viewYear === selYear && m === selMonth;
              return (
                <button
                  type="button"
                  key={label}
                  disabled={disabled}
                  onClick={() => pick(m)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-[#1B651B] text-white"
                      : disabled
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-2 border-t flex justify-end">
            <button type="button" onClick={jumpThisMonth} className="text-xs font-medium text-[#1B651B] hover:underline">
              This month
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthPicker;