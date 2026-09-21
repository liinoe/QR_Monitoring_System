import React, { useState } from "react";
import Pagination from "./Pagination";
import HoverTooltip from "./HoverTooltip";

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

const GuestLogTable = ({ data = [] }) => {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const displayedData = data.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="bg-white rounded-[10px] border shadow-sm">
      <div className="overflow-x-auto rounded-t-[10px] overflow-hidden">
        <table className="data-table w-full text-sm">
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
                  <td className="p-4 text-gray-600 max-w-[200px]">
                    {item.purpose === "Other" && item.other_purpose ? (
                      <HoverTooltip label={item.other_purpose}>
                        <span className="inline-flex items-center gap-1 cursor-help border-gray-300 hover:border-gray-500 hover:text-gray-800 transition-colors">
                          Other
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-400 flex-shrink-0">
                            <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </HoverTooltip>
                    ) : (
                      item.purpose || "—"
                    )}
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
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${isInside ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isInside ? 'bg-[#166534]' : 'bg-[#991B1B]'}`} />
                      {isInside ? 'Inside' : 'Outside'}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        </table>
      </div>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(n) => { setRowsPerPage(n); setCurrentPage(1); }}
        rowsPerPageOptions={[10, 20]}
        totalItems={data.length}
        itemLabel="logs"
      />
    </div>
  );
};

export default GuestLogTable;