import React, { useState, useEffect } from "react";
import cvsuLogo from "../assets/cvsu_logo.png";

const Header = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="w-full h-[72px] bg-[#1B5E20] border-b-[3px] border-[#F5C518] flex items-center justify-between px-6 flex-shrink-0 shadow-md">
      <div className="flex items-center gap-3.5">
        <img
          src={cvsuLogo}
          alt="CvSU Logo"
          className="w-12 h-12 object-contain flex-shrink-0"
        />
        <div>
          <h1 className="text-[17px] font-bold text-white leading-tight tracking-[0.02em]">
            Library Patron Access and Monitoring System
          </h1>
          <p className="text-[11px] text-white opacity-75 mt-0.5">
            Ladislao N. Diwa Memorial Library and Museum - Cavite State University - Main Campus
          </p>
        </div>
      </div>

      <div className="text-[26px] font-bold font-mono tracking-wide text-white">
        {formatTime(currentTime)}
      </div>
    </div>
  );
};

export default Header;