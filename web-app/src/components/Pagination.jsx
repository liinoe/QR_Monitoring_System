import React from "react";
import FilterSelect from "./FilterSelect";

// Builds a short page list like [1, 2, '...', 8, 9, 10] instead of
// showing every page number when there are many pages.
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

// Left/right arrow for the Previous/Next buttons.
const Arrow = ({ dir }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points={dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
  </svg>
);

// Bottom bar of a table: rows-per-page dropdown, "Showing 1–10 of 50", and page buttons.
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
  const atStart = currentPage === 1;
  const atEnd = currentPage === totalPages || totalPages === 0;

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-[#F1F3F1] flex-wrap gap-3">
      <div className="flex items-center gap-4">
        <FilterSelect dropUp value={rowsPerPage} onChange={(e) => onRowsPerPageChange(Number(e.target.value))}>
          {rowsPerPageOptions.map((n) => (
            <option key={n} value={n}>{n} per page</option>
          ))}
        </FilterSelect>
        <p className="text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-700">{totalItems > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + rowsPerPage, totalItems)}</span> of{" "}
          <span className="font-semibold text-gray-700">{totalItems}</span> {itemLabel}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={atStart}
          aria-label="Previous page"
          className={`w-9 h-9 rounded-full flex items-center justify-center text-gray-600 transition-colors ${atStart ? "opacity-40 cursor-not-allowed" : "hover:bg-[#E8F1E9] hover:text-[#1B5E20]"}`}
        >
          <Arrow dir="left" />
        </button>

        {pageList.map((num, i) =>
          num === "..." ? (
            <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-xs text-gray-400">...</span>
          ) : (
            <button
              type="button"
              key={num}
              onClick={() => onPageChange(num)}
              className={`w-9 h-9 rounded-full text-[13px] font-bold transition-colors ${
                num === currentPage ? "bg-[#1B5E20] text-white" : "text-gray-600 hover:bg-[#E8F1E9] hover:text-[#1B5E20]"
              }`}
            >
              {num}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={atEnd}
          aria-label="Next page"
          className={`w-9 h-9 rounded-full flex items-center justify-center text-gray-600 transition-colors ${atEnd ? "opacity-40 cursor-not-allowed" : "hover:bg-[#E8F1E9] hover:text-[#1B5E20]"}`}
        >
          <Arrow dir="right" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
