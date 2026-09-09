import React from "react";

const RegistrationItem = ({
  studentNumber, name, email, college, program, period, status,
  isLatest, currentStatus, onRowClick,
  onApprove, onReject, onDeactivate, onReactivate,
}) => {
  const statusColor = {
    pending: "bg-yellow-100 text-yellow-700",
    "pending renewal": "bg-orange-100 text-orange-700",
    "expired / unapproved": "bg-gray-200 text-gray-600",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    deactivated: "bg-gray-200 text-gray-600",
  };

  const renderAction = () => {
  if (!isLatest) {
    return (
      <span className="text-xs text-gray-400 italic">
        Updated — now {currentStatus?.toUpperCase() || "updated"}
      </span>
    );
  }

  if (status === "pending" || status === "pending renewal") {
    // Hide buttons if academic info hasn't been submitted from mobile yet
    if (!college || college === "—") {
      return <span className="text-xs text-gray-400 italic">Awaiting student submission</span>;
    }

    return (
      <>
        <button
          onClick={onApprove}
          className="rounded-full bg-gradient-to-b from-[#22C55E] to-[#16A34A] text-white px-5 py-2 text-xs font-bold shadow-sm hover:shadow-md hover:brightness-95 active:brightness-90 transition-all duration-200"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          className="rounded-full bg-gray-200 text-gray-700 px-5 py-2 text-xs font-bold shadow-sm hover:bg-[#DC2626] hover:text-white hover:shadow-md active:bg-[#B91C1C] transition-all duration-200"
        >
          Reject
        </button>
      </>
    );
  }
       
    if (status === "pending" || status === "pending renewal") {
      if (!college || college === "—") {
        return <span className="text-xs text-gray-400 italic">Awaiting student renewal submission</span>;
      }

      return (
        <>
          <button
            onClick={onApprove}
            className="rounded-full bg-gradient-to-b from-[#22C55E] to-[#16A34A] text-white px-5 py-2 text-xs font-bold shadow-sm hover:shadow-md hover:brightness-95 active:brightness-90 transition-all duration-200"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            className="rounded-full bg-gray-200 text-gray-700 px-5 py-2 text-xs font-bold shadow-sm hover:bg-[#DC2626] hover:text-white hover:shadow-md active:bg-[#B91C1C] transition-all duration-200"
          >
            Reject
          </button>
        </>
      );
    }

    if (status === "approved") {
      return (
        <button
          onClick={onDeactivate}
          className="rounded-full bg-gradient-to-b from-[#F59E0B] to-[#D97706] text-white px-5 py-2 text-xs font-bold shadow-sm hover:shadow-md hover:brightness-95 active:brightness-90 transition-all duration-200"
        >
          Deactivate
        </button>
      );
    }

    if (status === "deactivated") {
      return (
        <button
          onClick={onReactivate}
          className="rounded-full bg-gradient-to-b from-[#3B82F6] to-[#2563EB] text-white px-5 py-2 text-xs font-bold shadow-sm hover:shadow-md hover:brightness-95 active:brightness-90 transition-all duration-200"
        >
          Reactivate
        </button>
      );
    }

    if (status === "rejected") {
      return <span className="text-xs text-gray-400 italic">Awaiting student resubmission</span>;
    }

    return null;
  };

  return (
    <tr
      onClick={onRowClick}
      className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${!isLatest ? "opacity-60" : ""}`}
    >
      <td className="p-4 text-gray-700 font-medium">{studentNumber}</td>
      <td className="p-4">
        <p className="text-gray-800 font-medium">{name}</p>
        <p className="text-xs text-gray-400">{email}</p>
      </td>
      <td className="p-4 text-gray-600">{college}</td>
      <td className="p-4 text-gray-600">{program}</td>
      <td className="p-4">
        <div className="flex flex-col items-start gap-1">
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${statusColor[status] || "bg-gray-100"}`}>
            {status?.toUpperCase()}
          </span>
          <span className="text-[10px] text-gray-400 whitespace-nowrap">
            {period}
          </span>
        </div>
      </td>
      <td className="p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {renderAction()}
        </div>
      </td>
    </tr>
  );
};

export default RegistrationItem;