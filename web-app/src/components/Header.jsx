import React from "react";

const Header = () => {
  return (
    <div className="w-full h-[140px] bg-[#1B651B] border-b-[5px] border-[#D4A017] relative flex-shrink-0">
      <img
        src="https://placehold.co/94x82"
        alt="logo"
        className="w-[94px] h-[82px] absolute left-[29px] top-[28px]"
      />
      <h1 className="absolute left-[150px] top-[40px] text-white text-[30px] font-bold">
        Library Patron Access and Monitoring System
      </h1>
      <p className="absolute left-[153px] top-[82px] text-white text-[15px] font-medium">
        Ladislao N. Diwa Memorial Library and Museum - Cavite State University - Main Campus
      </p>
      <p className="absolute right-[150px] top-[58px] text-white text-[20px]">
        Friday, Apr 3, 2026
      </p>

      {/* PROFILE */}
      <div className="w-[60px] h-[56px] bg-[#539C7FBA] rounded-full absolute right-[40px] top-[40px]" />
      <span className="absolute right-[58px] top-[50px] text-white text-[30px] font-bold">
        K
      </span>
    </div>
  );
};

export default Header;