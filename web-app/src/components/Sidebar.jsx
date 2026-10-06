import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAdmin, isSuperAdmin, logout, authFetch } from "../auth";
import { Avatar, Dialog, btn } from "./AdminUI";
import ChangePasswordDialog from "./ChangePasswordDialog";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Small outline icons for the menu (same style as the rest of the system).
const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  studentLogs: (
    <>
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
    </>
  ),
  guestLogs: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  registrations: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </>
  ),
  manageStudents: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </>
  ),
  analytics: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
};

// Draws one menu icon (color follows the text color).
const MenuIcon = ({ name, size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
    {ICONS[name]}
  </svg>
);

// Left menu of the admin pages: links with icons, the pending-registrations
// badge, and the signed-in admin with Change Password and Log Out buttons at the bottom.
const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = getAdmin();
  const superAdmin = isSuperAdmin();
  const [isOpen, setIsOpen] = useState(false); // phone/tablet: menu opened with the "Menu" button
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Gets how many registrations are waiting (for the badge), every 10 seconds.
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await authFetch(`${API_URL}/api/admin/pending`);
        const data = await response.json();
        setPendingCount(Array.isArray(data) ? data.length : 0);
      } catch {
        // offline for a moment — try again next time
      }
    };
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const menu = [
    { name: "Dashboard", path: "/", icon: "dashboard" },
    { name: "Student Logs", path: "/student-logs", icon: "studentLogs" },
    { name: "Guest Logs", path: "/guest-logs", icon: "guestLogs" },
    { name: "Registrations", path: "/registrations", icon: "registrations", badge: pendingCount },
    { name: "Manage Students", path: "/manage-students", icon: "manageStudents" },
    { name: "Analytics", path: "/analytics", icon: "analytics" },
    ...(superAdmin ? [{ name: "Settings", path: "/settings", icon: "settings" }] : []),
  ];

  // Browser tab title follows the page, e.g. "Dashboard · QLess".
  useEffect(() => {
    const current = menu.find((m) => m.path === location.pathname);
    document.title = current ? `${current.name} · QLess` : "QLess";
  }, [location.pathname]);

  // "Yes, Log Out": signs out and goes to the login page.
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside
      className={`app-sidebar w-[260px] bg-white border-r border-[#ECEFEC] flex-shrink-0 flex flex-col justify-between
        lg:sticky lg:top-[68px] lg:h-[calc(100vh-68px)] lg:self-start ${isOpen ? "is-open" : ""}`}
    >
      {/* Log out confirmation (kept first so the profile box stays the last item) */}
      <Dialog
        open={showLogoutConfirm}
        tone="warning"
        title="Log Out?"
        message="You'll need to sign in again to use the admin pages."
        footer={
          <>
            <button type="button" onClick={() => setShowLogoutConfirm(false)} className={btn.secondary}>Cancel</button>
            <button type="button" onClick={handleLogout} className={btn.danger}>Log Out</button>
          </>
        }
      />

      {/* Change my password pop-up ("Change password" under the name) */}
      <ChangePasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />

      {/* Phone / tablet only: shows or hides the menu */}
      <button
        type="button"
        className="app-menu-button"
        aria-expanded={isOpen}
        aria-controls="admin-navigation"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="app-menu-icon" aria-hidden="true"><span /><span /><span /></span>
        <span>Menu</span>
      </button>

      <nav id="admin-navigation" className="app-navigation px-4 pt-6 overflow-y-auto">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.08em] px-3 mb-2">Menu</p>
        <div className="space-y-1">
          {menu.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`w-full h-[44px] flex items-center gap-3 px-3 rounded-[12px] text-[14.5px] transition-colors
                  ${isActive
                    ? "is-active bg-[#E8F1E9] text-[#1B5E20] font-bold"
                    : "text-gray-600 font-medium hover:bg-[#F7F8F7] hover:text-[#1B5E20]"}`}
              >
                <MenuIcon name={item.icon} />
                <span className="flex-1 truncate">{item.name}</span>
                {!!item.badge && item.badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#B3261E] text-white text-[11px] font-bold leading-none">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Signed-in admin + Log Out */}
      {admin && (
        <div className="p-4">
          <div className="rounded-[16px] bg-[#F7F8F7] p-3">
            <div className="flex items-center gap-3">
              <Avatar name={admin.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{admin.name}</p>
                <p className="text-xs text-gray-500">{admin.role === "super_admin" ? "Super Admin" : "Admin"}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                aria-label="Log out"
                title="Log out"
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-[#FBDFDB] hover:text-[#B3261E] transition-colors"
              >
                <MenuIcon name="logout" size={17} />
              </button>
            </div>

            {/* Change password (under the name) */}
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="mt-2 w-full flex items-center gap-2 px-2 py-2 rounded-[10px] text-[13px] font-semibold text-gray-600 hover:bg-[#E8F1E9] hover:text-[#1B5E20] transition-colors"
            >
              <MenuIcon name="key" size={15} />
              Change password
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
