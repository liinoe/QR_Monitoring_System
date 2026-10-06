import React from "react";

// List of "name ........ value" rows, each with a thin bar showing how big it is
// compared to the largest one (like the scanner's college tiles).
//   data      [{ key, name, value }]
//   colorFor  function that returns a bar color for each row
const StatBarList = ({ data, colorFor = () => "#1B5E20", emptyLabel = "No data yet" }) => {
  if (!data || data.length === 0) {
    return <div className="h-full min-h-[120px] flex items-center justify-center text-sm text-gray-400">{emptyLabel}</div>;
  }

  const maxVal = Math.max(...data.map((d) => d.value));

  return (
    <div>
      {data.map((item, i) => {
        const share = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
        return (
          <div key={item.key} className="py-2.5">
            <div className="flex items-center justify-between mb-1.5 gap-3">
              <span className="text-sm font-medium text-gray-700 truncate">{item.name}</span>
              <span className="text-sm font-bold text-gray-900 flex-shrink-0 tabular-nums">{item.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#F1F3F1] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share}%`, backgroundColor: colorFor(item, i) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatBarList;
