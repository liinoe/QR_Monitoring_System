import React from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import FilterButton from "../../components/FilterButton";
import StudentLogTable from "../../components/StudentLogTable";

const StudentLogs = () => {
  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">

      {/* HEADER  */}
      <Header />

      {/* BODY */}
      <div className="flex flex-1">

        {/* SIDEBAR */}
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
            <Card title="Total logs today"    value="382"    subtitle="Updated today" color="text-green-700"   border="border-green-700" />
            <Card title="Currently Inside"    value="143"    subtitle="Updated today" color="text-blue-700"    border="border-blue-700" />
            <Card title="Total exits today"   value="235"    subtitle="Updated today" color="text-orange-700"  border="border-orange-700" />
            <Card title="Avg. Stay Duration"  value="1.8 hr" subtitle="Updated today" color="text-emerald-700" border="border-emerald-700" />
          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-4 items-center">

            <input
              type="text"
              placeholder="Search by name or student no..."
              className="border px-4 py-2 rounded w-[250px]"
            />

            <div className="flex gap-2">
              <FilterButton active>All</FilterButton>
              <FilterButton>Entry</FilterButton>
              <FilterButton>Exit</FilterButton>
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