import React, { useState, useEffect } from "react";

// Colors per pop-up type: "red" for Reject, "gold" for Deactivate.
const TONES = {
  red: { fg: "#B3261E", bg: "#FBDFDB", btn: "bg-[#B3261E] hover:bg-[#9a2019]" },
  gold: { fg: "#946800", bg: "#FBF1CE", btn: "bg-[#946800] hover:bg-[#7a5600]" },
};

// Pop-up where the admin picks (or types) a reason for rejecting or deactivating.
// The reason is shown to the student in the mobile app.
//   tone           "red" | "gold"
//   presetReasons  list of ready-made reasons; "Other (specify below)" clears the box
//   onConfirm(reason) / onCancel()
const ReasonModal = ({ visible, title, actionLabel, tone = "red", presetReasons, onConfirm, onCancel }) => {
  const [selectedPreset, setSelectedPreset] = useState("");
  const [reasonText, setReasonText] = useState("");
  const t = TONES[tone] || TONES.red;

  // Starts fresh every time the pop-up opens for a new student.
  useEffect(() => {
    if (visible) {
      setSelectedPreset("");
      setReasonText("");
    }
  }, [visible]);

  if (!visible) return null;

  // Picking a preset fills the box (still editable); "Other" empties it for typing.
  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset);
    setReasonText(preset === "Other (specify below)" ? "" : preset);
  };

  // "Confirm": only works when there's a reason.
  const handleConfirm = () => {
    if (!reasonText.trim()) return;
    onConfirm(reasonText.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#071A0F]/40 backdrop-blur-sm">
      <div className="w-full max-w-[480px] bg-white rounded-[12px] shadow-lg p-7">
        {/* Icon + title */}
        <div className="flex flex-col">
          <h2 className="text-[19px] font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1.5">This reason will be shown to the student in their app.</p>
        </div>

        {/* Ready-made reasons (radio-style) */}
        <div className="space-y-2 mt-5">
          {presetReasons.map((preset) => {
            const active = selectedPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded-[8px] text-sm border-2 transition-colors ${
                  active ? "border-[#1B5E20] bg-[#E8F1E9] text-[#1B5E20] font-semibold" : "border-[#ECEFEC] text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? "border-[#1B5E20]" : "border-gray-300"}`}>
                  {active && <span className="w-2 h-2 rounded-full bg-[#1B5E20]" />}
                </span>
                {preset}
              </button>
            );
          })}
        </div>

        {/* Editable reason */}
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-[0.08em] mt-5 mb-1.5 ml-1">
          Reason (editable)
        </label>
        <textarea
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          rows={3}
          placeholder="Type or edit the reason here..."
          className="w-full bg-white border border-[#E3E7E3] rounded-[8px] px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 resize-none outline-none focus:border-[#1B5E20] focus:ring-4 focus:ring-[#1B5E20]/10"
        />

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 bg-[#E8F1E9] hover:bg-[#dbe9dc] text-[#1B5E20] py-3 rounded-[8px] text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reasonText.trim()}
            className={`flex-1 text-white py-3 rounded-[8px] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${t.btn}`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReasonModal;
