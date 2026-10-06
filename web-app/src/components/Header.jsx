import React from "react";
import cvsuLogo from "../assets/cvsu_logo.png";
import QLessMark from "./QLessMark";

// Top bar of every admin page — same deep green as the guest kiosk, scanner and
// mobile app header: CvSU logo + system name on the left, the QLess logo on the right.
// (The clock stays on the kiosk pages; admins have the computer's clock.)
// Stays at the top while the page scrolls.
const Header = () => (
  <header className="app-header sticky top-0 z-30 w-full h-[68px] bg-[#0E3B1F] flex items-center justify-between px-6 flex-shrink-0">
    <div className="flex items-center gap-3 min-w-0">
      <img src={cvsuLogo} alt="CvSU Logo" className="w-10 h-10 object-contain flex-shrink-0" />
      <div className="min-w-0 leading-tight">
        <h1 className="text-[15px] font-extrabold text-white tracking-wide truncate">
          Library Patron Access and Monitoring System
        </h1>
        <p className="text-[11px] text-white/60 mt-0.5 truncate">
          Ladislao N. Diwa Memorial Library · Cavite State University – Main Campus
        </p>
      </div>
    </div>

    {/* QLess logo + name (gold Q, like the mobile app) */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <QLessMark size={34} tone="dark" />
      <span className="text-[20px] font-extrabold text-white tracking-wide">
        <span className="text-[#F0CD5A]">Q</span>Less
      </span>
    </div>
  </header>
);

export default Header;
