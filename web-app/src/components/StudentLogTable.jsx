import React, { useState } from "react";
import Pagination from "./Pagination";
import { TimeOutCell } from "./AdminUI";

// Table of student entry/exit logs, 10 or 20 rows per page.
//   data: [{ studentNo, program, college, date, timeIn, timeOut, inside, forced }]
const StudentLogTable = ({ data = [] }) => {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const displayedData = data.slice(startIndex, startIndex + rowsPerPage);

  // No overflow-hidden on the outer box, so the rows-per-page list isn't cut off.
  return (
    <div className="bg-white rounded-[12px] border border-[#ECEFEC]">
      <div className="overflow-x-auto rounded-t-[20px]">
        <table className="data-table w-full text-sm">
          <thead>
            <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] border-b border-[#F1F3F1]">
              <th className="px-5 py-4 text-left">No.</th>
              <th className="px-5 py-4 text-left">Student No.</th>
              <th className="px-5 py-4 text-left">Program / College</th>
              <th className="px-5 py-4 text-left">Date</th>
              <th className="px-5 py-4 text-left">Time In</th>
              <th className="px-5 py-4 text-left">Time Out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F3F1]">
            {displayedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400">No student logs found.</td>
              </tr>
            ) : (
              displayedData.map((item, index) => (
                <tr key={index} className="hover:bg-[#F7F8F7] transition-colors">
                  <td className="px-5 py-3.5 text-gray-400 tabular-nums">{startIndex + index + 1}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">{item.studentNo}</td>
                  {/* Program in bold, college in gray underneath */}
                  <td className="px-5 py-3.5 max-w-[320px]">
                    <p className="font-semibold text-gray-900 truncate">{item.program || "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.college}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 tabular-nums">{item.date}</td>
                  <td className="px-5 py-3.5 text-gray-600 tabular-nums">{item.timeIn}</td>
                  <td className="px-5 py-3.5">
                    <TimeOutCell inside={item.inside} time={item.timeOut} forced={item.forced} />
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

export default StudentLogTable;
