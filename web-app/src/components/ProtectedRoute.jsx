import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isSuperAdmin, getToken, verifySession, logout } from "../auth";
import LoginRequestWatcher from "./LoginRequest";
import TempPasswordPrompt from "./TempPasswordPrompt";

// Remembers which token was already confirmed in this page load, so moving
// between pages doesn't show the spinner or re-check every time.
let verifiedToken = null;

// "checking" = asking the server, "valid" = OK, "invalid" = session is gone
function useSessionCheck() {
    const token = getToken();
    const [status, setStatus] = useState(
        !token ? "invalid" : token === verifiedToken ? "valid" : "checking"
    );

    useEffect(() => {
        if (!token) { setStatus("invalid"); return; }
        if (token === verifiedToken) { setStatus("valid"); return; }

        let cancelled = false;
        verifySession().then((ok) => {
            if (cancelled) return;
            if (ok) {
                verifiedToken = token;
                setStatus("valid");
            } else {
                logout(); // clears the dead token (the "session expired" notice is already saved by authFetch)
                setStatus("invalid");
            }
        });
        return () => { cancelled = true; };
    }, [token]);

    return status;
}

// Shown while the server is being asked if the saved login is still alive.
const CheckingSession = () => (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1B5E20]" />
        <p className="text-sm">Checking your session…</p>
    </div>
);

// Wrap any route that requires being logged in as any admin/staff
export const ProtectedRoute = ({ children }) => {
    const status = useSessionCheck();
    if (status === "checking") return <CheckingSession />;
    if (status === "invalid") return <Navigate to="/login" replace />;
    return (
        <>
            {children}
            {/* Allow / Deny prompt when this account signs in from another browser */}
            <LoginRequestWatcher />
            {/* "Change your password?" after signing in with a given password */}
            <TempPasswordPrompt />
        </>
    );
};

// Wrap any route that requires super_admin specifically (e.g. Analytics, Settings)
export const SuperAdminRoute = ({ children }) => {
    const status = useSessionCheck();
    if (status === "checking") return <CheckingSession />;
    if (status === "invalid") return <Navigate to="/login" replace />;
    if (!isSuperAdmin()) {
        return <Navigate to="/" replace />;
    }
    return (
        <>
            {children}
            <LoginRequestWatcher />
            {/* "Change your password?" after signing in with a given password */}
            <TempPasswordPrompt />
        </>
    );
};