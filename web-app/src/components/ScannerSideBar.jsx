const ScannerSideBar = () => {
  return (
    <div className="w-[320px] bg-[#F3FAF3] p-6 space-y-6">

      {/* DATE CARD */}
      <div className="bg-green-800 text-white rounded-lg p-6 text-center">
        <p className="text-lg">Friday</p>
        <h2 className="text-2xl font-bold">April 3, 2026</h2>
      </div>

      {/* TOTAL VISITORS */}
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500 text-sm">Total Visitors Today</p>
        <h2 className="text-5xl text-green-800 font-semibold">500</h2>
      </div>

      {/* LIVE BOARD */}
      <div>
        <p className="text-gray-500 text-sm mb-2">Live Visitor Board</p>

        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "CAFENR", color: "bg-green-800" },
            { name: "CEIT",   color: "bg-orange-500" },
            { name: "CAS",    color: "bg-yellow-400" },
            { name: "CON",    color: "bg-green-400" },
            { name: "CCJ",    color: "bg-purple-700" },
            { name: "CSPEAR", color: "bg-red-600" },
            { name: "CTHM",   color: "bg-blue-700" },
            { name: "CEMDS",  color: "bg-red-900" },
            { name: "CVMBS",  color: "bg-pink-500" },
            { name: "CED",    color: "bg-blue-500" },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white shadow rounded flex items-center p-2 gap-2"
            >
              <div className={`w-1 h-10 ${item.color} rounded`} />
              <div>
                <p className="font-medium">20</p>
                <p className="text-xs text-gray-500">{item.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ScannerSideBar;