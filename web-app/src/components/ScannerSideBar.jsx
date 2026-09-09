import React from "react";

const ScannerSideBar = ({ currentTime, totalInside, guestsInside = 0, boardData = {}, colleges }) => {
  const weekday = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="scanner-sidebar w-[320px] bg-gradient-to-b from-[#EAF5EA] to-[#F3FAF3] p-6 space-y-5 min-h-full">

      {/* DATE CARD */}
      <div className="bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] text-white rounded-xl p-6 text-center shadow-lg shadow-green-900/20 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -left-8 -bottom-8 w-20 h-20 rounded-full bg-white/5" />
        <p className="text-sm font-medium opacity-80 relative">{weekday}</p>
        <h2 className="text-2xl font-bold relative mt-1">{monthDay}</h2>
      </div>

      {/* STUDENTS INSIDE + GUESTS INSIDE */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-green-100 p-4 text-center">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Students Inside</p>
          <h2 className="text-4xl text-[#1B5E20] font-extrabold leading-none">{totalInside}</h2>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] text-gray-400 font-medium">Live</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-blue-100 p-4 text-center">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Guests Inside</p>
          <h2 className="text-4xl text-blue-700 font-extrabold leading-none">{guestsInside}</h2>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-[10px] text-gray-400 font-medium">Live</p>
          </div>
        </div>
      </div>

      {/* LIVE BOARD */}
      <div>
        <p className="text-[#1B5E20] text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1B5E20]" />
          Live Visitor Board
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          {colleges.map((item) => {
            const count = boardData[item.id] ?? 0;
            return (
              <div
                key={item.id}
                className="bg-white shadow-sm rounded-lg flex items-center p-2.5 gap-2.5 border border-gray-100 hover:shadow-md transition-shadow"
                style={{ borderLeft: `4px solid ${item.color}` }}
              >
                <div className="flex flex-col leading-tight">
                  <p className="font-bold text-lg" style={{ color: count > 0 ? item.color : '#9ca3af' }}>
                    {count}
                  </p>
                  <p className="text-[10px] text-gray-500 font-semibold tracking-wide">{item.id}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default ScannerSideBar;