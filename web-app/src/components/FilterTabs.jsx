import React from "react";

// Pill-style tabs in a white rounded bar (like the guest form's purpose buttons).
//   options  list of labels; value = selected label; onChange(label)
//   counts   optional { label: number } — shows a small number on those tabs (hidden when 0)
const FilterTabs = ({ options, value, onChange, counts = {} }) => (
  <div className="inline-flex flex-wrap bg-white rounded-full p-1 border border-[#E3E7E3]">
    {options.map((tab) => (
      <button
        key={tab}
        type="button"
        onClick={() => onChange(tab)}
        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
          value === tab ? "bg-[#1B5E20] text-white" : "text-gray-600 hover:text-[#1B5E20]"
        }`}
      >
        {tab}
        {counts[tab] > 0 && (
          <span
            className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-5 text-center ${
              value === tab ? "bg-white text-[#1B5E20]" : "bg-[#FBF1CE] text-[#946800]"
            }`}
          >
            {counts[tab] > 99 ? "99+" : counts[tab]}
          </span>
        )}
      </button>
    ))}
  </div>
);

export default FilterTabs;
