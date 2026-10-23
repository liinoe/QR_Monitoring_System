import React from "react";

// Search box with a magnifier icon (white, rounded, thin border).
const SearchInput = ({ value, onChange, placeholder = "Search..." }) => (
  <div className="relative">
    <svg
      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="pl-10 pr-4 py-2.5 rounded-[8px] w-[280px] bg-white text-sm text-gray-800 placeholder:text-gray-400 border border-[#E3E7E3] outline-none focus:ring-4 focus:ring-[#1B5E20]/10 transition"
    />
  </div>
);

export default SearchInput;
