const StudentLogTable = ({ data = [] }) => {
  return (
    <div className="bg-white rounded-[10px] border overflow-hidden">

      {/* TABLE */}
      <table className="w-full text-sm">
        <thead className="bg-[#F3FAF3] text-[#1B651B]">
          <tr>
            <th className="p-3 text-left">No.</th>
            <th className="p-3 text-left">Student No.</th>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">College</th>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Time</th>
            <th className="p-3 text-left">Type</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Action</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-t">
              <td className="p-3">{index + 1}</td>
              <td className="p-3">{item.studentNo}</td>
              <td className="p-3">{item.name}</td>
              <td className="p-3">{item.college}</td>
              <td className="p-3">{item.date}</td>
              <td className="p-3">{item.time}</td>

              <td className="p-3">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                  {item.type}
                </span>
              </td>

              <td className="p-3">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                  {item.status}
                </span>
              </td>

              <td className="p-3">...</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ✅ PAGINATION */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">

        {/* LEFT */}
        <div className="flex items-center gap-4">

          <select className="border px-3 py-1 rounded text-sm">
            <option>7 items</option>
            <option>10 items</option>
            <option>20 items</option>
          </select>

          <p className="text-sm text-gray-500">
            Showing 1–7 of 382 logs
          </p>
        </div>

        {/* CENTER (PAGES) */}
        <div className="flex items-center gap-2">

          {[1, 2, 3, 4, 5].map((page) => (
            <button
              key={page}
              className={`w-8 h-8 rounded 
                ${page === 1 
                  ? "bg-green-700 text-white" 
                  : "text-gray-600 hover:bg-gray-200"}`}
            >
              {page}
            </button>
          ))}

          <span className="px-2 text-gray-500">...</span>

          <button className="w-8 h-8 text-gray-600 hover:bg-gray-200 rounded">
            15
          </button>
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

export default StudentLogTable;