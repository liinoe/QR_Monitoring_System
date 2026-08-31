import React, { useState } from "react";

const TYPE_STYLES = {
  faculty: "bg-blue-100 text-blue-700",
  alumni: "bg-amber-100 text-amber-700",
  walkin: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-700",
};

const formatTypeLabel = (type) => {
  if (!type) return "N/A";
  if (type === "walkin") return "Walk-in";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const GuestLogTable = ({ data = [], onMarkExited }) => {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const displayedData = data.slice(startIndex, startIndex + rowsPerPage);

  const handleNext = () => { if (safePage < totalPages) setCurrentPage(safePage + 1); };
  const handlePrevious = () => { if (safePage > 1) setCurrentPage(safePage - 1); };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-[10px] border overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[#F3FAF3] text-[#1B651B] border-b">
          <tr>
            <th className="p-4 text-left font-semibold">No.</th>
            <th className="p-4 text-left font-semibold">Full Name</th>
            <th className="p-4 text-left font-semibold">Visitor Type</th>
            <th className="p-4 text-left font-semibold">Purpose</th>
            <th className="p-4 text-left font-semibold">Date</th>
            <th className="p-4 text-left font-semibold">Time In</th>
            <th className="p-4 text-left font-semibold">Time Out</th>
            <th className="p-4 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {displayedData.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-8 text-center text-gray-400">No guest logs found.</td>
            </tr>
          ) : (
            displayedData.map((item, index) => {
              const isInside = item.status === 'inside';
              return (
                <tr key={item.guest_log_id || index} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-600">{startIndex + index + 1}</td>
                  <td className="p-4 text-gray-700 font-medium">{item.full_name || "Unknown"}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${TYPE_STYLES[item.guest_type] || TYPE_STYLES.other}`}>
                      {formatTypeLabel(item.guest_type)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">
                    {item.purpose || "—"}{item.other_purpose ? ` (${item.other_purpose})` : ""}
                  </td>
                  <td className="p-4 text-gray-600">
                    {item.visit_date ? new Date(item.visit_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-4 text-gray-600">
                    {item.time_in ? new Date(item.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                  </td>
                  <td className="p-4 text-gray-600">
                    {item.time_out ? new Date(item.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${isInside ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isInside ? 'bg-[#166534]' : 'bg-[#991B1B]'}`} />
                        {isInside ? 'Inside' : 'Outside'}
                      </span>
                      {isInside && onMarkExited && (
                        <button
                          onClick={() => onMarkExited(item.guest_log_id)}
                          className="text-[11px] text-gray-400 hover:text-red-600 hover:underline"
                        >
                          Mark exited
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 bg-white border-t">
        <div className="flex items-center gap-4">
          <select
            className="border px-3 py-1.5 rounded-lg text-sm bg-white outline-none"
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
          >
            <option value={10}>10 items</option>
            <option value={20}>20 items</option>
          </select>
          <p className="text-sm text-gray-400">
            Showing {data.length > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + rowsPerPage, data.length)} of {data.length} logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={safePage === 1}
            className={`border px-3 py-1 rounded-lg text-sm text-gray-600 ${safePage === 1 ? 'opacity-50' : 'hover:bg-gray-50'}`}
          >
            ← Previous
          </button>

          {pageNumbers.map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`w-8 h-8 rounded text-xs font-bold ${
                num === safePage ? 'bg-[#1B651B] text-white' : 'border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {num}
            </button>
          ))}

          <button
            onClick={handleNext}
            disabled={safePage === totalPages}
            className={`border px-3 py-1 rounded-lg text-sm text-gray-600 ${safePage === totalPages ? 'opacity-50' : 'hover:bg-gray-50'}`}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestLogTable;