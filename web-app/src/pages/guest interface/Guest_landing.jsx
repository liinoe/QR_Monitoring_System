import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/cvsu_logo.png";

const GuestLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-screen bg-[#1B5E20] font-sans flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center text-center max-w-[520px]">
        <img src={logo} alt="CvSU Logo" className="w-24 h-24 object-contain mb-6" />

        <h1 className="text-white text-3xl font-bold leading-tight mb-2">
          Welcome to the Library
        </h1>
        <p className="text-[#D7ECD8] text-sm mb-1">
          Ladislao N. Diwa Memorial Library
        </p>
        <p className="text-[#D7ECD8] text-sm mb-10">
          Please log your visit before entering the premises.
        </p>

        <div className="flex flex-col w-full max-w-xs mx-auto gap-3 mt-2">
          <button
            onClick={() => navigate("/guest")}
            className="bg-[#F5C518] hover:bg-[#e0b510] text-[#1B5E20] font-semibold px-8 py-3 rounded-lg text-base transition-colors shadow-md w-full"
          >
            Log In →
          </button>
          
          <button
            onClick={() => navigate("/guest-logout")}
            className="bg-transparent border border-white/40 hover:bg-white hover:text-[#1B5E20] text-white font-medium px-8 py-3 rounded-lg text-base transition-colors w-full"
          >
            Log Out
          </button>
        </div>

        <p className="text-[#A9D6AA] text-[11px] mt-8">
          Your information is recorded securely and used only for library access monitoring.
        </p>
      </div>
    </div>
  );
};

export default GuestLanding;