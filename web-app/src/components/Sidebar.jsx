import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAdmin, isSuperAdmin, logout } from "../auth";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = getAdmin();
  const superAdmin = isSuperAdmin();

  const menu = [
    { name: "Dashboard", path: "/" },
    { name: "Student Logs", path: "/student-logs" },
    { name: "Guest Logs", path: "/guest-logs" },
    { name: "Registrations", path: "/registrations" },
    // Analytics only shown to super admins
    ...(superAdmin ? [{ name: "Analytics", path: "/analytics" }] : []),
    { name: "Settings", path: "/settings" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="w-[300px] bg-white flex-shrink-0 flex flex-col justify-between">
      <div>
        {menu.map((item, i) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={i}
              to={item.path}
              className={`w-full h-[50px] flex items-center pl-[39px] mt-[20px] text-[23px] border-l-[5px] transition-colors duration-150
                ${
                  isActive
                    ? "bg-[#F3FAF3] border-[#1B651B] text-[#1B651B] font-medium"
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
            onClick={handleLogout}
            className="text-sm text-[#B91C1C] hover:underline"
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;