const RegistrationItem = ({ name, details, date, status }) => {
  const statusColor = {
    Pending: "bg-yellow-100 text-yellow-700",
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-lg p-4 flex justify-between items-center border-l-4 border-[#D4A017]">

      <div>
        <p className="text-[#666] font-medium">{name}</p>
        <p className="text-xs text-gray-500">{details}</p>
        <p className="text-xs text-gray-400">{date}</p>
      </div>

      <div className="flex items-center gap-3">

        <span className={`px-2 py-1 rounded text-xs ${statusColor[status]}`}>
          {status}
        </span>

        {status === "Pending" && (
          <>
            <button className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-xs">
              Approve
            </button>
            <button className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-xs">
              Reject
            </button>
          </>
        )}

        {status === "Approved" && (
          <button className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-xs">
            Deactivate
          </button>
        )}

        {status === "Rejected" && (
          <button className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-xs">
            Re-review
          </button>
        )}

        <button className="text-blue-600 text-xs">
          View →
        </button>

      </div>
    </div>
  );
};

export default RegistrationItem;