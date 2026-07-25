import React from "react";

const RegistrationItem = ({ name, details, date, status, onApprove, onReject }) => {
  const statusColor = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-lg p-4 flex justify-between items-center border-l-4 border-[#D4A017]">
      <div>
        <p className="text-[#666] font-medium">{name}</p>
        <p className="text-xs text-gray-500">{details}</p>
        <p className="text-xs text-gray-400">{date}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded text-xs ${statusColor[status] || "bg-gray-100"}`}>
          {status}
        </span>

        {(status === "pending") && (
          <>
            <button
              onClick={onApprove}
              className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-xs hover:bg-green-300"
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-xs hover:bg-red-300"
            >
              Reject
            </button>
          </>
        )}

        {(status === "approved") && (
          <button className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-xs">
            Deactivate
          </button>
        )}
      </div>
    </div>
  );
};

export default RegistrationItem;