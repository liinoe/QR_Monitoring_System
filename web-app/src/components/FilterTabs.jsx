import React from "react";

// Pill-style tabs in a white rounded bar (like the guest form's purpose buttons).
//   options  list of labels; value = selected label; onChange(label)
const FilterTabs = ({ options, value, onChange }) => (
  <div className="inline-flex flex-wrap bg-white rounded-full p-1 border border-[#E3E7E3]">
    {options.map((tab) => (
      <button
        key={tab}
        type="button"
        onClick={() => onChange(tab)}
        className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
          value === tab ? "bg-[#1B5E20] text-white" : "text-gray-600 hover:text-[#1B5E20]"
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

export default FilterTabs;
