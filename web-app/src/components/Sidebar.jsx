import React from "react";
import { Link, useLocation } from "react-router-dom";

const Sidebar = () => {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", path: "/" },
    { name: "Student Logs", path: "/student-logs" },
    { name: "Guest Logs", path: "/guest-logs" },
    { name: "Registrations", path: "/registrations" },
    { name: "Analytics", path: "/analytics" },
    { name: "Settings", path: "/settings" },
  ];

  return (
    <div className="w-[300px] bg-white flex-shrink-0">
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
  );
};

export default Sidebar;