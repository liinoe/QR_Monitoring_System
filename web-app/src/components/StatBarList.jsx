import React from "react";

const StatBarList = ({ data, colorFor = () => '#16a34a', emptyLabel = "No data yet" }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400">
        {emptyLabel}
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.value));

  return (
    <div>
      {data.map((item, i) => {
        const share = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
        return (
          <div key={item.key} className="py-2.5 border-b last:border-0">
            <div className="flex items-center justify-between mb-1.5 gap-3">
              <span className="text-sm text-gray-700 truncate">{item.name}</span>
              <span className="text-sm font-semibold text-gray-800 flex-shrink-0">{item.value}</span>
            </div>
            <div className="h-[4px] rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: colorFor(item, i) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatBarList;