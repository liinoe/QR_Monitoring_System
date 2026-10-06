import React, { useState } from "react";
import { authFetch, getAdmin, updateAdmin } from "../auth";
import { Dialog, btn } from "./AdminUI";
import ChangePasswordDialog from "./ChangePasswordDialog";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Shown once after signing in with a password the super admin made.
// The staff member decides: set their own password now, or keep the given one.
// Either answer stops the prompt (they can still change it later from the sidebar).
const TempPasswordPrompt = () => {
  const [open, setOpen] = useState(() => !!getAdmin()?.password_is_temp);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);

  // "Keep this password": tells the server not to ask again.
  const keepPassword = async () => {
    setBusy(true);
    try {
      await authFetch(`${API_URL}/api/admin/keep-password`, { method: "POST" });
    } catch {
      // offline — just hide it for now; it will ask again next sign-in
    }
    updateAdmin({ password_is_temp: false });
    setBusy(false);
    setOpen(false);
  };

  // Closing the change-password pop-up: done if they changed it, otherwise ask again.
  const closeChange = () => {
    setChanging(false);
    if (!getAdmin()?.password_is_temp) setOpen(false);
  };

  if (!open) return null;

  return (
    <>
      <Dialog
        open={!changing}
        tone="warning"
        title="Change your password?"
        message="You're signed in with the password the super admin gave you. You can set your own now, or keep using this one. You can always change it later with Change password under your name in the menu."
        footer={
          <>
            <button type="button" disabled={busy} onClick={keepPassword} className={btn.secondary}>Keep it</button>
            <button type="button" onClick={() => setChanging(true)} className={btn.primary}>Change now</button>
          </>
        }
      />
      <ChangePasswordDialog open={changing} onClose={closeChange} />
    </>
  );
};

export default TempPasswordPrompt;
