import React from "react";
import { RegStatusPill } from "./AdminUI";

// Button styles for the Action column (pill-shaped, like the rest of the system).
const ACTION_BTN = {
  approve: "rounded-full bg-[#1B5E20] text-white px-4 py-2 text-xs font-bold hover:bg-[#164a1a] transition-colors",
  reject: "rounded-full bg-[#F1F3F1] text-gray-600 px-4 py-2 text-xs font-bold hover:bg-[#FBDFDB] hover:text-[#B3261E] transition-colors",
  deactivate: "rounded-full bg-[#FBF1CE] text-[#946800] px-4 py-2 text-xs font-bold hover:bg-[#F7E3A6] transition-colors",
  reactivate: "rounded-full bg-[#E8F1E9] text-[#1B5E20] px-4 py-2 text-xs font-bold hover:bg-[#dbe9dc] transition-colors",
};

// Small gray italic note shown instead of buttons.
const Note = ({ children }) => <span className="text-xs text-gray-400 italic">{children}</span>;

// One row in the Registrations table. Clicking the row opens the student's details;
// the buttons on the right approve / reject / deactivate / reactivate.
const RegistrationItem = ({
  studentNumber, name, email, college, program, period, status,
  isLatest, currentStatus, onRowClick,
  onApprove, onReject, onDeactivate, onReactivate,
}) => {
  // Picks which buttons (or note) to show, based on the request's status.
  const renderAction = () => {
    // An older request of a student who has a newer one: no actions here.
    if (!isLatest) {
      return <Note>Updated — now {currentStatus || "updated"}</Note>;
    }

    if (status === "pending" || status === "pending renewal") {
      // Hide buttons if academic info hasn't been submitted from mobile yet
      if (!college || college === "—") return <Note>Awaiting student submission</Note>;
      return (
        <>
          <button onClick={onApprove} className={ACTION_BTN.approve}>Approve</button>
          <button onClick={onReject} className={ACTION_BTN.reject}>Reject</button>
        </>
      );
    }

    if (status === "approved") {
      return <button onClick={onDeactivate} className={ACTION_BTN.deactivate}>Deactivate</button>;
    }

    if (status === "deactivated") {
      return <button onClick={onReactivate} className={ACTION_BTN.reactivate}>Reactivate</button>;
    }

    if (status === "rejected") return <Note>Awaiting student resubmission</Note>;

    // Pending from an earlier semester that nobody answered.
    if (status === "not reviewed") return <Note>From an earlier semester</Note>;

    // Semester ended: the student renews when the next semester starts.
    if (status === "expired") return <Note>Renews next semester</Note>;

    return null;
  };

  return (
    <tr
      onClick={onRowClick}
      className={`hover:bg-[#F7F8F7] cursor-pointer transition-colors ${!isLatest ? "opacity-60" : ""}`}
    >
      <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">{studentNumber}</td>
      {/* Name in bold, email in gray */}
      <td className="px-5 py-3.5 max-w-[240px]">
        <p className="font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{email}</p>
      </td>
      {/* Program in bold, college in gray (same as Student Logs) */}
      <td className="px-5 py-3.5 max-w-[280px]">
        <p className="font-semibold text-gray-900 truncate">{program || "—"}</p>
        <p className="text-xs text-gray-500 mt-0.5">{college}</p>
      </td>
      {/* Status pill, with the semester in gray */}
      <td className="px-5 py-3.5">
        <RegStatusPill status={status} />
        <p className="text-[11px] text-gray-400 mt-1 whitespace-nowrap">{period}</p>
      </td>
      {/* Buttons don't open the details pop-up */}
      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">{renderAction()}</div>
      </td>
    </tr>
  );
};

export default RegistrationItem;
