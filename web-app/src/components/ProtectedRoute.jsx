import React from "react";
import { Navigate } from "react-router-dom";
import { isLoggedIn, isSuperAdmin } from "../auth";

// Wrap any route that requires being logged in as any admin/staff
export const ProtectedRoute = ({ children }) => {
    if (!isLoggedIn()) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

// Wrap any route that requires super_admin specifically (e.g. Analytics, Settings)
export const SuperAdminRoute = ({ children }) => {
    if (!isLoggedIn()) {
        return <Navigate to="/login" replace />;
    }
    if (!isSuperAdmin()) {
        return <Navigate to="/" replace />;
    }
    return children;
};