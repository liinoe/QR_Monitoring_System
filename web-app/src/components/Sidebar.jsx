import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAdmin, isSuperAdmin, logout } from "../auth";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = getAdmin();
  const superAdmin = isSuperAdmin();
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menu = [
    { name: "Dashboard", path: "/" },
    { name: "Student Logs", path: "/student-logs" },
    { name: "Guest Logs", path: "/guest-logs" },
    { name: "Registrations", path: "/registrations" },
    { name: "Manage Students", path: "/manage-students" },
    ...(superAdmin ? [{ name: "Analytics", path: "/analytics" }] : []),
    ...(superAdmin ? [{ name: "Settings", path: "/settings" }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className={`app-sidebar w-[300px] bg-white flex-shrink-0 flex flex-col justify-between ${isOpen ? "is-open" : ""}`}>
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

      <div id="admin-navigation" className="app-navigation">
        {menu.map((item, i) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={i}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`w-full h-[50px] flex items-center pl-[39px] mt-[20px] text-[23px] border-l-[5px] transition-colors duration-150
                ${
                  isActive
                    ? "is-active bg-[#F3FAF3] border-[#1B651B] text-[#1B651B] font-medium"
                    : "border-transparent text-[#666] hover:bg-[#F3FAF3] hover:border-[#1B651B] hover:text-[#1B651B]"
                }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      {admin && (
        <div className="border-t px-[39px] py-[20px]">
          <p className="text-sm font-medium text-gray-800">{admin.name}</p>
          <p className="text-xs text-gray-500 capitalize mb-3">{admin.role.replace('_', ' ')}</p>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-lg py-2 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log Out
          </button>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[340px] overflow-hidden">
            <div className="p-6 text-center">
              <p className="text-base font-semibold text-gray-800">Log out?</p>
              <p className="text-sm text-gray-500 mt-1">Are you sure you want to log out of your account?</p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 border border-gray-300 text-gray-600 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;