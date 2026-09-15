import React, { useState } from "react";
import Pagination from "./Pagination";

const StudentLogTable = ({ data = [] }) => {
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
            <th className="p-4 text-left font-semibold">Student No.</th>
            <th className="p-4 text-left font-semibold">College</th>
            <th className="p-4 text-left font-semibold">Date</th>
            <th className="p-4 text-left font-semibold">Time In</th>
            <th className="p-4 text-left font-semibold">Time Out</th>
            <th className="p-4 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {displayedData.map((item, index) => (
            <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
              <td className="p-4 text-gray-600">{startIndex + index + 1}</td>
              <td className="p-4 text-gray-700 font-medium">{item.studentNo}</td>
              <td className="p-4 text-gray-600">{item.college}</td>
              <td className="p-4 text-gray-600">{item.date}</td>
              <td className="p-4 text-gray-600">{item.timeIn}</td>
              <td className="p-4 text-gray-600">{item.timeOut}</td>
              <td className="p-4">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${item.status === 'Active' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Active' ? 'bg-[#166534]' : 'bg-[#991B1B]'}`} />
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
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