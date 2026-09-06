import React, { useState, useEffect } from "react";

const ReasonModal = ({ visible, title, actionLabel, actionColor, presetReasons, onConfirm, onCancel }) => {
  const [selectedPreset, setSelectedPreset] = useState("");
  const [reasonText, setReasonText] = useState("");

  // Reset every time the modal opens for a new item
  useEffect(() => {
    if (visible) {
      setSelectedPreset("");
      setReasonText("");
    }
  }, [visible]);

  if (!visible) return null;

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset);
    // "Other" clears the box for custom typing; any real preset pre-fills
    // it but stays editable, per the requirement that admins can pick a
    // reason OR type their own.
    setReasonText(preset === "Other (specify below)" ? "" : preset);
  };

  const handleConfirm = () => {
    if (!reasonText.trim()) return;
    onConfirm(reasonText.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[14px] w-full max-w-[480px] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-800 mb-1">{title}</h2>
        <p className="text-sm text-gray-500 mb-4">
          This reason will be shown to the student in their app.
        </p>

        <div className="space-y-2 mb-4">
          {presetReasons.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                selectedPreset === preset
                  ? "bg-[#F3FAF3] border-[#1B651B] text-[#1B651B] font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
          Reason (editable)
        </label>
        <textarea
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          rows={3}
          placeholder="Type or edit the reason here..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-green-600"
        />

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleConfirm}
            disabled={!reasonText.trim()}
            className={`flex-1 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${actionColor}`}
          >
            {actionLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReasonModal;