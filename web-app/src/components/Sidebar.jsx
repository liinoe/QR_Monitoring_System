import React from "react";

const Sidebar = () => {
  return (
    <div className="w-[300px] bg-white flex-shrink-0">
      {["Dashboard", "Student Logs", "Guest Logs", "Registrations", "Analytics", "Settings"].map(
        (item, i) => (
          <button
            key={i}
            className={`w-full h-[50px] flex items-center pl-[39px] mt-[20px] text-[23px] border-l-[5px] transition-colors duration-150
              ${i === 0
                ? "bg-[#F3FAF3] border-[#1B651B] text-[#1B651B] font-medium"
                : "border-transparent text-[#666] hover:bg-[#F3FAF3] hover:border-[#1B651B] hover:text-[#1B651B]"
              }`}
          >
            {item}
          </button>
        )
      )}
    </div>
  );
};

export default Sidebar;