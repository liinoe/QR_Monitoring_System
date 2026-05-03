const GuestLogTable = ({ data = [] }) => {
  return (
    <div className="bg-white rounded-[10px] border overflow-hidden">

      {/* TABLE */}
      <table className="w-full text-sm">
        <thead className="bg-[#F3FAF3] text-[#1B651B]">
          <tr>
            <th className="p-3 text-left">No.</th>
            <th className="p-3 text-left">Full Name</th>
            <th className="p-3 text-left">Visitor Type</th>
            <th className="p-3 text-left">Purpose</th>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Time In</th>
            <th className="p-3 text-left">Time Out</th>
            <th className="p-3 text-left">Status</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-t">
              <td className="p-3">{index + 1}</td>
              <td className="p-3">{item.name}</td>

              {/* VISITOR TYPE */}
              <td className="p-3">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    item.type === "Faculty"
                      ? "bg-blue-100 text-blue-700"
                      : item.type === "Alumni"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-purple-100 text-purple-700" // Walk-in
                  }`}
                >
                  {item.type}
                </span>
              </td>

              <td className="p-3">{item.purpose}</td>
              <td className="p-3">{item.date}</td>
              <td className="p-3">{item.timeIn}</td>
              <td className="p-3">{item.timeOut || "—"}</td>

              {/* STATUS */}
              <td className="p-3">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    item.status === "Inside"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINATION (same as student) */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">

        {/* LEFT */}
        <div className="flex items-center gap-4">
          <select className="border px-3 py-1 rounded text-sm">
            <option>7 items</option>
            <option>10 items</option>
            <option>20 items</option>
          </select>

          <p className="text-sm text-gray-500">
            Showing 1–{data.length} of {data.length} logs
          </p>
        </div>

        {/* CENTER */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((page) => (
            <button
              key={page}
              className={`w-8 h-8 rounded ${
                page === 1
                  ? "bg-green-700 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          <button className="border px-3 py-1 rounded text-sm text-gray-600 hover:bg-gray-100">
            ← Previous
          </button>

          <button className="border px-3 py-1 rounded text-sm text-gray-600 hover:bg-gray-100">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestLogTable;