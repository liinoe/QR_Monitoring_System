const FilterButton = ({ children, active }) => {
  return (
    <button
      className={`px-4 py-1 rounded-full border text-sm
        ${active
          ? "bg-green-700 text-white"
          : "text-gray-600 hover:bg-gray-100"
        }`}
    >
      {children}
    </button>
  );
};

export default FilterButton;