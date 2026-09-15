import React from "react";

const FilterTabs = ({ options, value, onChange }) => (
  <div className="flex gap-2 flex-wrap">
    {options.map((tab) => (
      <button
        key={tab}
        type="button"
        onClick={() => onChange(tab)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          value === tab
            ? "bg-[#1B651B] text-white"
            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

export default FilterTabs;