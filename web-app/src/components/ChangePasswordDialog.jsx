import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { authFetch, updateAdmin } from "../auth";
import { AuthInput, PasswordRules, checkPasswordRules } from "./AuthInput";
import { btn } from "./AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Pop-up where a signed-in admin changes their own password
// (opened from the sidebar key button or the "change your password?" prompt).
//   open      show / hide
//   onClose   called by Cancel / Done
const ChangePasswordDialog = ({ open, onClose }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Clears the form every time the pop-up opens.
  useEffect(() => {
    if (open) {
      setCurrent(""); setNext(""); setConfirm(""); setError(""); setDone(false);
    }
  }, [open]);

  if (!open) return null;

  const rulesOk = Object.values(checkPasswordRules(next)).every(Boolean);
  const matches = confirm.length > 0 && confirm === next;
  const canSave = current && rulesOk && matches && !saving;

  // "Change Password": sends the current and new password to the server.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setError("");
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Could not change the password.");
        return;
      }
      updateAdmin({ password_is_temp: false }); // stop the first-login prompt
      setDone(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Drawn straight into <body> (portal) so it covers the whole page,
  // not just the sidebar it's opened from.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#071A0F]/40 backdrop-blur-sm">
      <div className="w-full max-w-[420px] bg-white rounded-[24px] shadow-2xl p-7">
        {done ? (
          // SUCCESS
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-[#E8F1E9] text-[#1B5E20] flex items-center justify-center mb-4">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 className="text-[19px] font-bold text-gray-900">Password changed</h3>
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
              Use your new password the next time you sign in. Other browsers signed in to this account were signed out.
            </p>
            <button type="button" onClick={onClose} className={`${btn.primary} w-full mt-6`}>Done</button>
          </div>
        ) : (
          // FORM
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-[#E8F1E9] text-[#1B5E20] flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <h3 className="text-[19px] font-bold text-gray-900">Change password</h3>
              <p className="text-sm text-gray-500 mt-1">Enter your current password, then choose a new one.</p>
            </div>

            {error && <div className="rounded-[12px] bg-[#FBDFDB] text-[#B3261E] text-sm font-semibold px-4 py-2.5 mb-4">{error}</div>}

            <div className="space-y-4">
              <AuthInput id="cp-current" label="Current password" type="password" autoComplete="current-password"
                placeholder="Your current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              <div>
                <AuthInput id="cp-new" label="New password" type="password" autoComplete="new-password"
                  placeholder="Enter a new password" value={next} onChange={(e) => setNext(e.target.value)} />
                <PasswordRules password={next} />
              </div>
              <div>
                <AuthInput id="cp-confirm" label="Confirm new password" type="password" autoComplete="new-password"
                  placeholder="Re-enter the new password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  error={confirm.length > 0 && !matches} />
                {confirm.length > 0 && (
                  <p className={`text-[12.5px] mt-2 ml-0.5 ${matches ? "text-[#1B5E20]" : "text-[#B3261E]"}`}>
                    {matches ? "✓ Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3 [&>*]:flex-1">
              <button type="button" onClick={onClose} className={btn.secondary}>Cancel</button>
              <button type="submit" disabled={!canSave} className={btn.primary}>{saving ? "Saving…" : "Change Password"}</button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ChangePasswordDialog;
