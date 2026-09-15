import React, { useState, useRef, useEffect } from "react";

const ChevronIcon = ({ open }) => (
  <svg
    className={`pointer-events-none w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 text-[#1B651B] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const FilterSelect = ({ value, onChange, children, className = "" }) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef(null);

  const options = React.Children.toArray(children).map((child) => ({
    value: child.props.value,
    label: child.props.children,
  }));

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => String(o.value) === String(value));
      setHighlighted(idx >= 0 ? idx : 0);
    }
  }, [open]);

  const selectOption = (opt) => {
    onChange({ target: { value: opt.value } });
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, options.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); if (options[highlighted]) selectOption(options[highlighted]); }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between gap-2 min-w-[140px] border border-gray-200 pl-4 pr-3 py-2 rounded-lg bg-white text-gray-600 text-sm outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 hover:border-gray-300 transition-colors cursor-pointer"
      >
        <span className="truncate">{selected ? selected.label : ""}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 min-w-full w-max bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
          {options.map((opt, i) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                type="button"
                key={String(opt.value)}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-left transition-colors ${
                  isSelected ? "bg-[#F3FAF3] text-[#1B651B] font-semibold" : i === highlighted ? "bg-gray-50 text-gray-700" : "text-gray-600"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterSelect;