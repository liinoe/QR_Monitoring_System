import React from "react";
import { RegStatusPill, Avatar } from "./AdminUI";

const SEX_LABELS = {
  male: "Male",
  female: "Female",
  prefer_not_to_say: "Prefer not to say",
};

// Shows a date + time like "10/5/2026, 9:41:00 AM", or "—" if empty.
const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

// One "LABEL / value" item in the details grid.
const DetailRow = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em]">{label}</span>
    <span className="text-sm text-gray-900 mt-0.5 break-words">{value || "—"}</span>
  </div>
);

// Small uppercase section heading with the items under it in a light gray box.
const Section = ({ title, children }) => (
  <div>
    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.08em] mb-2 ml-1">{title}</p>
    <div className="rounded-[16px] bg-[#F7F8F7] p-4">{children}</div>
  </div>
);

// Pop-up with everything a student submitted (opened by clicking a row in Registrations).
const StudentDetailsModal = ({ visible, request, currentPeriod, allRequests = [], onClose }) => {
  if (!visible || !request) return null;

  const {
    full_name, surname, first_name, middle_name,
    email, phone_number, address, sex,
    student_number, college, program, year_level, period,
    approval_status, reason, created_at, approved_at,
  } = request;

  // Renewal = this request is for the current semester AND the student was
  // approved in an earlier semester (same rule as the Registrations table).
  const isRenewal =
    period === currentPeriod &&
    allRequests.some(
      (r) =>
        r.student_number === student_number &&
        r.request_id !== request.request_id &&
        r.period !== currentPeriod &&
        (r.approval_status === "approved" || r.approval_status === "expired")
    );

  // Same status label as the table (old unanswered requests show as expired).
  let displayStatus = approval_status;
  if (approval_status === "pending") {
    if (period === currentPeriod) displayStatus = isRenewal ? "pending renewal" : "pending";
    else displayStatus = "expired / unapproved";
  }

  const displayName = first_name && surname ? `${first_name} ${middle_name ? middle_name.charAt(0).toUpperCase() + ". " : ""}${surname}` : full_name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A0F]/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[620px] max-h-[88vh] overflow-y-auto bg-white rounded-[24px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: initials, student number, name and status */}
        <div className="px-7 pt-7 pb-5 flex items-start gap-4">
          <Avatar name={displayName} />
          <div className="flex-1 min-w-0">
            {/* Student number in bold, name in gray underneath */}
            <p className="text-[18px] font-bold text-gray-900 leading-tight tabular-nums">{student_number}</p>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{displayName || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">{period}</p>
          </div>
          <RegStatusPill status={displayStatus} />
        </div>

        <div className="px-7 pb-2 space-y-5">
          <Section title="Personal information">
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
          </Section>

          <Section title="Academic information">
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="College" value={college} />
              <DetailRow label="Program" value={program} />
              <DetailRow label="Year Level" value={year_level} />
            </div>
          </Section>

          <Section title="Submission">
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Submitted" value={formatDate(created_at)} />
              {approval_status === "approved" && <DetailRow label="Approved" value={formatDate(approved_at)} />}
            </div>
          </Section>

          {/* Why it was rejected / deactivated */}
          {(approval_status === "rejected" || approval_status === "deactivated") && reason && (
            <div className="rounded-[16px] bg-[#FBDFDB] px-4 py-3">
              <p className="text-[11px] font-bold text-[#B3261E] uppercase tracking-[0.06em]">
                Reason for {approval_status === "rejected" ? "rejection" : "deactivation"}
              </p>
              <p className="text-sm text-[#8C1D17] mt-1">{reason}</p>
            </div>
          )}
        </div>

        <div className="px-7 py-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#E8F1E9] hover:bg-[#dbe9dc] text-[#1B5E20] px-6 py-2.5 rounded-[12px] text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailsModal;
