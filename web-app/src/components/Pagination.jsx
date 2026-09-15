import React from "react";
import FilterSelect from "./FilterSelect";

// Builds a compact page list like [1, 2, '...', 8, 9, 10] instead of
// rendering every page number when there are a lot of pages.
const getPageList = (current, total) => {
     if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

     const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
     const sorted = Array.from(keep).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

     const result = [];
     let prev = 0;
     for (const p of sorted) {
     if (prev && p - prev > 1) result.push("...");
     result.push(p);
     prev = p;
     }
     return result;
};

const Pagination = ({
     currentPage,
     totalPages,
     onPageChange,
     rowsPerPage,
     onRowsPerPageChange,
     rowsPerPageOptions = [10, 20],
     totalItems,
     itemLabel = "items",
}) => {
     const startIndex = (currentPage - 1) * rowsPerPage;
     const pageList = getPageList(currentPage, totalPages);

     return (
     <div className="flex items-center justify-between p-4 bg-white border-t rounded-b-[10px] flex-wrap gap-3">
          <div className="flex items-center gap-4">
          <FilterSelect
               value={rowsPerPage}
               onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          >
               {rowsPerPageOptions.map((n) => (
               <option key={n} value={n}>{n} items</option>
               ))}
          </FilterSelect>
          <p className="text-sm text-gray-400">
               Showing {totalItems > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + rowsPerPage, totalItems)} of {totalItems} {itemLabel}
          </p>
          </div>

          <div className="flex items-center gap-2">
          <button
               type="button"
               onClick={() => onPageChange(Math.max(1, currentPage - 1))}
               disabled={currentPage === 1}
               className={`border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-600 transition-colors ${
               currentPage === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
               }`}
          >
               ← Previous
          </button>

          {pageList.map((num, i) =>
               num === "..." ? (
               <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">
               ...
               </span>
               ) : (
               <button
               type="button"
               key={num}
               onClick={() => onPageChange(num)}
               className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    num === currentPage ? "bg-[#1B651B] text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
               }`}
               >
               {num}
               </button>
               )
          )}

          <button
               type="button"
               onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
               disabled={currentPage === totalPages || totalPages === 0}
               className={`border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-600 transition-colors ${
               currentPage === totalPages || totalPages === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
               }`}
          >
               Next →
          </button>
          </div>
     </div>
     );
};

export default Pagination;