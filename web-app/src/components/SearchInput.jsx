import React from "react";

const SearchInput = ({ value, onChange, placeholder = "Search..." }) => (
  <div className="relative">
    <svg
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
      className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg w-[280px] bg-white text-sm text-gray-700 outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-colors"
    />
  </div>
);

export default SearchInput;