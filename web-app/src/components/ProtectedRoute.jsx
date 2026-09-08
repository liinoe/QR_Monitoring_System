import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { isLoggedIn, isSuperAdmin, getAdmin, logout, ACTIVE_LOCK_KEY } from "../auth";

// Shared by both route guards below. Listens for the browser-wide login
// lock changing in another tab (the `storage` event only ever fires in
// OTHER tabs, never the one that made the change — exactly what's needed
// here). If a different identity takes over the lock while this tab is
// sitting on a protected page, this tab logs itself out immediately
// instead of silently going stale until its next API call happens to fail.
function useSingleSessionGuard() {
  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key !== ACTIVE_LOCK_KEY) return;

      const newLock = e.newValue ? JSON.parse(e.newValue) : null;
      const myAdmin = getAdmin();
      if (!myAdmin) return; // this tab isn't logged in anyway

      if (!newLock) {
        // Lock was cleared (another tab logged out) — nothing to do,
        // this tab's own session is unaffected.
        return;
      }

      if (newLock.admin_id !== myAdmin.admin_id) {
        // A different admin just logged in elsewhere in this browser —
        // this tab has been superseded.
        logout("You were signed out because another admin signed in on this browser.");
        window.location.href = "/login";
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
}

// Wrap any route that requires being logged in as any admin/staff
export const ProtectedRoute = ({ children }) => {
     useSingleSessionGuard();
     if (!isLoggedIn()) {
     return <Navigate to="/login" replace />;
     }
     return children;
};

// Wrap any route that requires super_admin specifically (e.g. Analytics)
export const SuperAdminRoute = ({ children }) => {
     useSingleSessionGuard();
     if (!isLoggedIn()) {
     return <Navigate to="/login" replace />;
     }
     if (!isSuperAdmin()) {
     return <Navigate to="/" replace />;
     }
     return children;
};