import React, { useState, useEffect } from "react";
import cvsuLogo from "../assets/cvsu_logo.png"; 

const Header = () => {
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const formatDate = () => {
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      };
      // Formats to "Weekday, Month Day, Year" (e.g., "Sunday, May 17, 2026")
      const formatted = new Date().toLocaleDateString('en-US', options);
      setCurrentDate(formatted);
    };

    formatDate();
    
    // Optional: Updates the date at midnight if the dashboard is left open
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timeToMidnight = midnight.getTime() - Date.now();
    
    const timer = setTimeout(() => {
      formatDate();
    }, timeToMidnight);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-[120px] bg-[#1B651B] border-b-[5px] border-[#D4A017] relative flex-shrink-0">
      <img
        src={cvsuLogo}
        alt="CvSU Logo"
        className="w-[94px] h-[82px] absolute left-[29px] top-[17px] object-contain"
      />
      <h1 className="absolute left-[150px] top-[25px] text-white text-[30px] font-bold">
        Library Patron Access and Monitoring System
      </h1>
      <p className="absolute left-[151px] top-[70px] text-white text-[15px] font-medium">
        Ladislao N. Diwa Memorial Library and Museum - Cavite State University - Main Campus
      </p>
      
      {/* Dynamic Live Date */}
      <p className="absolute right-[60px] top-[40px] text-white text-[20px]">
        {currentDate}
      </p>
    </div>
  );
};

export default Header;