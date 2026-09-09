import React, { useState } from "react";

const StudentLogTable = ({ data = [] }) => {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayedData = data.slice(startIndex, startIndex + rowsPerPage);

  const handleNext = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handlePrevious = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };

  return (
    <div className="data-table-container bg-white rounded-[10px] border overflow-hidden shadow-sm">
      <table className="data-table w-full text-sm">
        <thead className="bg-[#F3FAF3] text-[#1B651B] border-b">
          <tr>
            <th className="p-4 text-left font-semibold">No.</th>
            <th className="p-4 text-left font-semibold">Student No.</th>
            <th className="p-4 text-left font-semibold">Name</th>
            <th className="p-4 text-left font-semibold">College</th>
            <th className="p-4 text-left font-semibold">Date</th>
            <th className="p-4 text-left font-semibold">Time</th>
            <th className="p-4 text-left font-semibold">Type</th>
            <th className="p-4 text-left font-semibold">Status</th>
            <th className="p-4 text-left font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {displayedData.map((item, index) => (
            <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
              <td className="p-4 text-gray-600">{startIndex + index + 1}</td>
              <td className="p-4 text-gray-700 font-medium">{item.studentNo}</td>
              <td className="p-4 text-gray-700">{item.name}</td>
              <td className="p-4 text-gray-600">{item.college}</td>
              <td className="p-4 text-gray-600">{item.date}</td>
              <td className="p-4 text-gray-600">{item.time}</td>
              <td className="p-4">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${item.type === 'Entry' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEF9C3] text-[#713F12]'}`}>
                  {item.type}
                </span>
              </td>
              <td className="p-4">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${item.status === 'Active' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Active' ? 'bg-[#166534]' : 'bg-[#991B1B]'}`} />
                  {item.status}
                </span>
              </td>
              <td className="p-4">{item.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 bg-white border-t">
        <div className="flex items-center gap-4">
          <select className="border px-3 py-1.5 rounded-lg text-sm bg-white outline-none" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
            <option value={10}>10 items</option>
            <option value={20}>20 items</option>
          </select>
          <p className="text-sm text-gray-400">Showing {data.length > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + rowsPerPage, data.length)} of {data.length} logs</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded bg-[#1B651B] text-white text-xs font-bold">{currentPage}</button>
          <div className="flex items-center gap-2 ml-4">
            <button onClick={handlePrevious} disabled={currentPage === 1} className={`border px-3 py-1 rounded-lg text-sm text-gray-600 ${currentPage === 1 ? 'opacity-50' : 'hover:bg-gray-50'}`}>← Previous</button>
            <button onClick={handleNext} disabled={currentPage === totalPages || totalPages === 0} className={`border px-3 py-1 rounded-lg text-sm text-gray-600 ${currentPage === totalPages || totalPages === 0 ? 'opacity-50' : 'hover:bg-gray-50'}`}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default StudentLogTable;