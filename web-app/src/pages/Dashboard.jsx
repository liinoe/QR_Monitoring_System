import React from "react";
import Sidebar from "../components/Sidebar";

const Dashboard = () => {
  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">

      {/* HEADER - full width across the top */}
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

      {/* BODY - sidebar + content side by side, below the header */}
      <div className="flex flex-1">

        <Sidebar />

        {/* MAIN CONTENT */}
        <div className="flex-1 px-[50px] pt-[40px]">

          {/* SECTION TITLE */}
          <p className="text-[#666] text-[16px] mb-[20px]">
            Here's what happening at the library today.
          </p>

					{/* CARDS */}
					<div className="grid grid-cols-4 gap-[20px]">

						<div className="h-[130px] bg-white border-t-2 border-[#1B651B] rounded p-[15px]">
								<p className="text-[#666] text-[16px]">Total visitors today</p>
								<p className="text-[#1B651B] text-[30px]">500</p>
								<p className="text-[#1B651B] text-[13px]">14% vs yesterday</p>
						</div>

						<div className="h-[130px] bg-white border-t-2 border-[#225276] rounded p-[15px]">
								<p className="text-[#666] text-[16px]">Currently Inside</p>
								<p className="text-[#225276] text-[30px]">143</p>
								<p className="text-[#225276] text-[13px]">Peak at 2-4 PM</p>
						</div>

						<div className="h-[130px] bg-white border-t-2 border-[#E76D22] rounded p-[15px]">
								<p className="text-[#666] text-[16px]">Pending Registrations</p>
								<p className="text-[#E76D22] text-[30px]">20</p>
								<p className="text-[#E76D22] text-[13px]">Needs review</p>
						</div>

						<div className="h-[130px] bg-white border-t-2 border-[#1E8C60] rounded p-[15px]">
								<p className="text-[#666] text-[16px]">Avg. Stay Duration</p>
								<p className="text-[#1E8C60] text-[30px]">1.8 hr</p>
								<p className="text-[#1E8C60] text-[13px]">Up from 1.4 hr</p>
						</div>

					</div>

					{/* ANALYTICS GRAPHS */}
					<div className="grid grid-cols-2 gap-[20px] mt-[20px]">

						<div className="bg-white rounded-[10px] p-[20px] h-[200px]">
							<p>Daily entries this week</p>
						</div>

						<div className="bg-white rounded-[10px] p-[20px] h-[200px]">
							<p>Visitors by College</p>
						</div>

					</div>

          {/* RECENT ACTIVITY */}
          <div className="mt-[20px] bg-white rounded-[10px] p-[20px] w-full">

            <div className="flex justify-between mb-[20px]">
              <p className="text-[#666] text-[15px]">Recent Activity</p>
              <p className="text-[#105020] text-[16px] cursor-pointer">
                View all Logs →
              </p>
            </div>

            {[
              { name: "John Doe", desc: "BSIT 3-3 - CEIT - Entry Verified", color: "bg-green-300" },
              { name: "John Doe", desc: "Submitted a Registration", color: "bg-blue-300" },
              { name: "John Doe", desc: "BSCS 3-4 - CEIT - Exit Logged", color: "bg-yellow-200" },
              { name: "John Doe", desc: "Entry denied - Session Expired", color: "bg-red-300" },
            ].map((item, i) => (
              <div key={i} className="flex items-center mb-[20px]">
                <div className={`w-[30px] h-[30px] rounded-full mr-[15px] ${item.color}`} />
                <div>
                  <p className="text-[#666] text-[16px]">{item.name}</p>
                  <p className="text-[#888] text-[12px]">{item.desc}</p>
                </div>
              </div>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;