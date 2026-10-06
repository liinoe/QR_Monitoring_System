import React, { useState, useRef, useEffect } from "react";

// Down arrow that flips when the list is open.
const ChevronIcon = ({ open }) => (
  <svg
    className={`pointer-events-none w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// Check mark next to the selected option.
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 text-[#1B5E20] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LIST_MAX_HEIGHT = 280; // px, same as max-h-[280px] below

// Custom dropdown (looks the same in every browser).
// Use it like <select>: pass <option value="">Label</option> children,
// value = selected value, onChange({ target: { value } }).
//   dropUp       always open the list ABOVE the button
//   fullWidth    button stretches to fill its box (for forms)
//   disabled     grayed out, can't be opened
//   placeholder  text shown when nothing is picked yet
// The list floats above everything (position: fixed), so it's never cut off by
// tables or pop-ups, and it opens upward by itself when there's no room below.
const FilterSelect = ({
  value, onChange, children, className = "",
  dropUp = false, fullWidth = false, disabled = false, placeholder = "Select...",
}) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  // Options with an empty value (e.g. "Select college") are only placeholders.
  const options = React.Children.toArray(children)
    .map((child) => ({ value: child.props.value, label: child.props.children, disabled: child.props.disabled }))
    .filter((o) => !(o.disabled && (o.value === "" || o.value === undefined)));

  const selected = options.find((o) => String(o.value) === String(value));

  // Works out where to show the list: under the button, or above it if there's no room.
  const placeList = () => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = dropUp || (spaceBelow < LIST_MAX_HEIGHT + 16 && r.top > spaceBelow);
    setPos({
      left: r.left,
      minWidth: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }),
    });
  };

  // Opens / closes the list.
  const toggle = () => {
    if (disabled) return;
    if (!open) placeList();
    setOpen((o) => !o);
  };

  // Closes the list when clicking anywhere else on the page.
  useEffect(() => {
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Closes the list if the page scrolls or resizes (the list wouldn't follow the button).
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (listRef.current && e && listRef.current.contains(e.target)) return; // scrolling inside the list is fine
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // When opening, highlight the currently selected option.
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => String(o.value) === String(value));
      setHighlighted(idx >= 0 ? idx : 0);
    }
  }, [open]);

  // Picks an option and closes the list.
  const selectOption = (opt) => {
    onChange({ target: { value: opt.value } });
    setOpen(false);
  };

  // Keyboard support: Enter/Space opens, arrows move, Enter picks, Esc closes.
  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        placeList();
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
    <div ref={rootRef} className={`relative ${fullWidth ? "w-full" : ""} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`flex items-center justify-between gap-2 ${fullWidth ? "w-full" : "min-w-[140px]"} pl-4 pr-3 py-2.5 rounded-[12px] border text-sm font-medium outline-none transition text-left
          ${open ? "border-[#1B5E20] ring-4 ring-[#1B5E20]/10" : "border-[#E3E7E3] focus:ring-4 focus:ring-[#1B5E20]/10"}
          ${disabled ? "bg-[#F4F5F4] text-gray-400 cursor-not-allowed" : "bg-white text-gray-700 cursor-pointer"}`}
      >
        <span className={`truncate ${selected ? "" : "text-gray-400 font-normal"}`}>{selected ? selected.label : placeholder}</span>
        <ChevronIcon open={open} />
      </button>

      {open && pos && (
        <div
          ref={listRef}
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth }}
          className="z-[60] max-w-[min(560px,calc(100vw-32px))] bg-white rounded-[14px] shadow-[0_12px_32px_rgba(11,31,18,0.18)] border border-[#ECEFEC] p-1.5 max-h-[280px] overflow-y-auto"
        >
          {options.map((opt, i) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                type="button"
                key={String(opt.value)}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[10px] text-sm text-left transition-colors ${
                  isSelected ? "bg-[#E8F1E9] text-[#1B5E20] font-semibold" : i === highlighted ? "bg-[#F7F8F7] text-gray-800" : "text-gray-600"
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
