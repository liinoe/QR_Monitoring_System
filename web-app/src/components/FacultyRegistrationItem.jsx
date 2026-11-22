import React, { useCallback, useState } from "react";
import { RegStatusPill } from "./AdminUI";
import ConfirmPopover from "./ConfirmPopover";

// Same button styles as RegistrationItem (the student rows). If you change them there,
// change them here too (or move both into AdminUI so there is only one copy).
const ACTION_BTN = {
  approve: "rounded-full bg-[#1B5E20] text-white px-4 py-2 text-xs font-bold hover:bg-[#164a1a] transition-colors",
  reject: "rounded-full bg-[#F1F3F1] text-gray-600 px-4 py-2 text-xs font-bold hover:bg-[#FBDFDB] hover:text-[#B3261E] transition-colors",
  deactivate: "rounded-full bg-[#FBF1CE] text-[#946800] px-4 py-2 text-xs font-bold hover:bg-[#F7E3A6] transition-colors",
  reactivate: "rounded-full bg-[#E8F1E9] text-[#1B5E20] px-4 py-2 text-xs font-bold hover:bg-[#dbe9dc] transition-colors",
};

// Small gray italic note shown instead of buttons.
const Note = ({ children }) => <span className="text-xs text-gray-400 italic">{children}</span>;

// One row in the Faculty Registrations table. Clicking the row opens the faculty member's
// details; the buttons on the right approve / reject / deactivate / reactivate.
// Faculty have no semesters, so there is no period, renewal or "paused" state here.
const FacultyRegistrationItem = ({
  employeeId, name, email, college, status,
  onRowClick, onApprove, onReject, onDeactivate, onReactivate,
}) => {
  // Where the Approve button is while its small confirmation box is open (null = closed).
  const [confirmAt, setConfirmAt] = useState(null);
  const closeConfirm = useCallback(() => setConfirmAt(null), []);

  // Picks which buttons (or note) to show, based on the request's status.
  const renderAction = () => {
    if (status === "pending") {
      return (
        <>
          {/* Approve asks first, in a small box right under the button */}
          <button onClick={(e) => setConfirmAt(e.currentTarget.getBoundingClientRect())} className={ACTION_BTN.approve}>
            Approve
          </button>
          <ConfirmPopover
            anchor={confirmAt}
            title="Approve this registration?"
            message={`${name || employeeId} will get an active library QR pass.`}
            confirmText="Approve"
            onCancel={closeConfirm}
            onConfirm={() => { closeConfirm(); onApprove(); }}
          />
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

    if (status === "rejected") return <Note>Awaiting faculty resubmission</Note>;

    return null;
  };

  return (
    <tr onClick={onRowClick} className="hover:bg-[#F7F8F7] cursor-pointer transition-colors">
      <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">{employeeId}</td>
      {/* Name in bold, email in gray */}
      <td className="px-5 py-3.5 max-w-[240px]">
        <p className="font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{email}</p>
      </td>
      <td className="px-5 py-3.5 text-gray-600">{college || "—"}</td>
      <td className="px-5 py-3.5">
        <RegStatusPill status={status} />
      </td>
      {/* Buttons don't open the details pop-up */}
      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">{renderAction()}</div>
      </td>
    </tr>
  );
};

export default FacultyRegistrationItem;