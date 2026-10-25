import React from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/cvsu_logo.png";

// Shown when the address doesn't match any page (e.g. a typo like /scanner/guest-landing),
// instead of a blank white screen. Links to the pages people usually look for.
const LINKS = [
  { to: "/scanner", label: "Entry & Exit Scanner", note: "Student QR scanning station" },
  { to: "/guest-landing", label: "Guest Kiosk", note: "Guest log in / log out" },
  { to: "/login", label: "Admin Sign In", note: "Library staff and admins" },
];

const NotFound = () => {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F7] font-sans">
      <header className="bg-[#0E3B1F] text-white px-6 py-3 flex items-center gap-3">
        <img src={logo} alt="CvSU Logo" className="w-9 h-9 object-contain" />
        <div className="leading-tight">
          <p className="text-[15px] font-bold">Library Patron Access and Monitoring System</p>
          <p className="text-[11px] text-white/60">Ladislao N. Diwa Memorial Library</p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[440px] bg-white border border-[#E4E4E7] rounded-[12px] p-6">
          <h1 className="text-[20px] font-bold text-gray-900">Page not found</h1>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            There's no page at <span className="font-mono text-gray-700 break-all">{pathname}</span>. Check the address, or go to one of these:
          </p>
          <div className="mt-5 space-y-2">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center justify-between rounded-[8px] border border-[#E4E4E7] px-4 py-3 hover:bg-[#F4F4F5] transition-colors"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{link.label}</span>
                  <span className="block text-xs text-gray-500">{link.note}</span>
                </span>
                <span className="text-xs font-mono text-[#1B5E20]">{link.to}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
