import React from "react";

const SEX_LABELS = {
     male: "Male",
     female: "Female",
     prefer_not_to_say: "Prefer not to say",
};

const STATUS_COLORS = {
     pending: "bg-yellow-100 text-yellow-700",
     "pending renewal": "bg-orange-100 text-orange-700",
     "expired / unapproved": "bg-gray-200 text-gray-600",
     approved: "bg-green-100 text-green-700",
     rejected: "bg-red-100 text-red-700",
     deactivated: "bg-gray-200 text-gray-600",
};

const formatDate = (value) => {
     if (!value) return "—";
     const d = new Date(value);
     return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const DetailRow = ({ label, value }) => (
     <div className="flex flex-col">
     <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
     <span className="text-sm text-gray-800 mt-0.5">{value || "—"}</span>
     </div>
);

const StudentDetailsModal = ({ visible, request, currentPeriod, allRequests = [], onClose }) => {
     if (!visible || !request) return null;

     const {
     full_name, surname, first_name, middle_name,
     email, phone_number, address, sex,
     student_number, college, program, year_level, period,
     approval_status, reason, created_at, approved_at,
     } = request;

     // Compute the same display status used in the table
     const studentRequests = allRequests.filter(r => r.student_number === student_number);
     const isRenewal = studentRequests.length > 1 && period === currentPeriod;

     let displayStatus = approval_status;
     if (approval_status === "pending") {
       if (period === currentPeriod) {
         displayStatus = isRenewal ? "pending renewal" : "pending";
       } else {
         displayStatus = "expired / unapproved";
       }
     }

     return (
     <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[14px] w-full max-w-[600px] max-h-[85vh] overflow-y-auto">
          <div className="px-6 pt-6 pb-4 border-b flex items-start justify-between">
               <div>
               <h2 className="text-lg font-bold text-gray-800">{full_name}</h2>
               <p className="text-xs text-gray-400 mt-0.5">Student No. {student_number}</p>
               </div>
               <span className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 ${STATUS_COLORS[displayStatus] || "bg-gray-100"}`}>
               {displayStatus?.toUpperCase()}
               </span>
          </div>

          <div className="px-6 py-5 space-y-6">
               <div>
               <h3 className="text-xs font-bold text-[#1B651B] uppercase tracking-wide mb-3">Personal Information</h3>
               <div className="grid grid-cols-2 gap-4">
               <DetailRow label="Surname" value={surname} />
               <DetailRow label="First Name" value={first_name} />
               <DetailRow label="Middle Name" value={middle_name} />
               <DetailRow label="Sex" value={SEX_LABELS[sex] || sex} />
               <DetailRow label="Email" value={email} />
               <DetailRow label="Phone Number" value={phone_number} />
               </div>
               <div className="mt-4">
               <DetailRow label="Address" value={address} />
               </div>
               </div>

               <div>
               <h3 className="text-xs font-bold text-[#1B651B] uppercase tracking-wide mb-3">Academic Information</h3>
               <div className="grid grid-cols-2 gap-4">
               <DetailRow label="College" value={college} />
               <DetailRow label="Program" value={program} />
               <DetailRow label="Year Level" value={year_level} />
               </div>
               </div>

               <div>
               <h3 className="text-xs font-bold text-[#1B651B] uppercase tracking-wide mb-3">Submission</h3>
               <div className="grid grid-cols-2 gap-4">
               <DetailRow label="Submitted" value={formatDate(created_at)} />
               {approval_status === "approved" && <DetailRow label="Approved" value={formatDate(approved_at)} />}
               </div>
               {(approval_status === "rejected" || approval_status === "deactivated") && reason && (
               <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">
                    Reason for {approval_status === "rejected" ? "Rejection" : "Deactivation"}
                    </span>
                    <p className="text-sm text-red-800 mt-1">{reason}</p>
               </div>
               )}
               </div>
          </div>

          <div className="px-6 py-4 border-t flex justify-end">
               <button
               onClick={onClose}
               className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
               >
               Close
               </button>
          </div>
          </div>
     </div>
     );
};

export default StudentDetailsModal;