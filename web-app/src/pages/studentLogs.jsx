import React from "react";
import Sidebar from "../components/Sidebar";
import StudentLogTable from "../components/StudentLogTable";

const StudentLogs = () => {
  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">

      {/* HEADER (same as Dashboard for consistency) */}
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
          CvSU - Main Campus Library
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

      {/* BODY */}
      <div className="flex flex-1">

        {/* ✅ REUSABLE SIDEBAR */}
        <Sidebar />

        {/* MAIN CONTENT */}
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px]">

          {/* TITLE */}
          <div className="flex justify-between">
            <p className="text-[#666] text-[16px]">
              All library entry and exit records.
            </p>
            <p className="text-[#666] text-[16px]">
              1st Semester A.Y. 2025-2026
            </p>
          </div>

          {/* CARDS */}
          <div className="grid grid-cols-4 gap-[20px]">

            <Card title="Total logs today" value="382" color="text-green-700" />
            <Card title="Currently Inside" value="143" color="text-blue-700" />
            <Card title="Total exits today" value="235" color="text-orange-700" />
            <Card title="Avg. Stay Duration" value="1.8 hr" color="text-emerald-700" />

          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-4 items-center">

            <input
              type="text"
              placeholder="Search by name or student no..."
              className="border px-4 py-2 rounded w-[250px]"
            />

            <div className="flex gap-2">
              <button className="bg-green-700 text-white px-4 py-1 rounded-full">
                All
              </button>
              <button className="border px-4 py-1 rounded-full">
                Entry
              </button>
              <button className="border px-4 py-1 rounded-full">
                Exit
              </button>
            </div>

            <select className="border px-3 py-2 rounded">
              <option>All Colleges</option>
            </select>

            <select className="border px-3 py-2 rounded">
              <option>All Status</option>
            </select>

          </div>

          {/* TABLE */}
          <StudentLogTable data={sampleData} />

        </div>
      </div>
    </div>
  );
};

/* CARD COMPONENT */
const Card = ({ title, value, color }) => {
  return (
    <div className="bg-white rounded p-4 border-t-4 border-green-700 shadow-sm">
      <p className="text-gray-500 text-sm">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400">Updated today</p>
    </div>
  );
};

const sampleData = [
  {
    studentNo: "202302075",
    name: "Kyla Payad",
    college: "CON",
    date: "2026-04-01",
    time: "12:01:12",
    type: "Entry",
    status: "Active",
  },
  {
    studentNo: "202302076",
    name: "Juan Dela Cruz",
    college: "CEIT",
    date: "2026-04-01",
    time: "12:15:45",
    type: "Exit",
    status: "Inactive",
  },
];

export default StudentLogs;