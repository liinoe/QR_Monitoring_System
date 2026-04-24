import React from "react";
import Sidebar from "../components/Sidebar";
import Card from "../components/Card";

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
            
            <Card title="Total visitors today" value="500" subtitle="14% vs. yesterday" color="text-[#1B651B]" border="border-[#1B651B]"/>
            <Card title="Currently Inside"  value="143" subtitle="Peak at 2-4 pm" color="text-[#225276]" border="border-[#225276]"/>
            <Card title="Pending Registrations" value="20" subtitle="needs review" color="text-[#E76D22]" border="border-[#E76D22]"/>
            <Card title="Avg. Stay Duration" value="1.8 hr" subtitle="up from 1.4 hr" color="text-[#1E8C60]" border="border-[#1E8C60]"/>

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