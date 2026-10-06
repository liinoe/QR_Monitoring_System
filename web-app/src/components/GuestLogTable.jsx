import React, { useState } from "react";
import Pagination from "./Pagination";
import HoverTooltip from "./HoverTooltip";
import { TimeOutCell } from "./AdminUI";

// "walkin" → "Walk-in", "faculty" → "Faculty".
const formatTypeLabel = (type) => {
  if (!type) return "N/A";
  if (type === "walkin") return "Walk-in";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

// Shows a time like "09:41 AM", or "—" if empty.
const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

// Table of guest visits, 10 or 20 rows per page.
// For data privacy, guest NAMES are not shown: the Guest column shows the
// visitor type (bold) and their affiliation / student type (gray).
const GuestLogTable = ({ data = [] }) => {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const displayedData = data.slice(startIndex, startIndex + rowsPerPage);

  // No overflow-hidden on the outer box, so the rows-per-page list isn't cut off.
  return (
    <div className="bg-white rounded-[20px] border border-[#ECEFEC]">
      <div className="overflow-x-auto rounded-t-[20px]">
        <table className="data-table w-full text-sm">
          <thead>
            <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] border-b border-[#F1F3F1]">
              <th className="px-5 py-4 text-left">No.</th>
              <th className="px-5 py-4 text-left">Guest</th>
              <th className="px-5 py-4 text-left">Purpose</th>
              <th className="px-5 py-4 text-left">Date</th>
              <th className="px-5 py-4 text-left">Time In</th>
              <th className="px-5 py-4 text-left">Time Out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F3F1]">
            {displayedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400">No guest logs found.</td>
              </tr>
            ) : (
              displayedData.map((item, index) => (
                <tr key={item.guest_log_id || index} className="hover:bg-[#F7F8F7] transition-colors">
                  <td className="px-5 py-3.5 text-gray-400 tabular-nums">{startIndex + index + 1}</td>
                  {/* Visitor type in bold, affiliation / student type in gray (no name) */}
                  <td className="px-5 py-3.5 max-w-[260px]">
                    <p className="font-semibold text-gray-900">{formatTypeLabel(item.guest_type)}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{item.affiliation || "—"}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 max-w-[200px]">
                    {item.purpose === "Other" && item.other_purpose ? (
                      // "Other" shows the guest's typed reason on hover
                      <HoverTooltip label={item.other_purpose}>
                        <span className="inline-flex items-center gap-1 cursor-help hover:text-gray-900 transition-colors">
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
                  <td className="px-5 py-3.5 text-gray-600 tabular-nums">
                    {item.visit_date ? new Date(item.visit_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 tabular-nums">{formatTime(item.time_in)}</td>
                  <td className="px-5 py-3.5">
                    <TimeOutCell inside={item.status === "inside"} time={formatTime(item.time_out)} forced={!!item.forced_exit} />
                  </td>
                </tr>
              ))
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
