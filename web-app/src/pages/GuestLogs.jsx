import React from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Card from "../components/Card";
import FilterButton from "../components/FilterButton";
import GuestLogTable from "../components/GuestLogTable";

const GuestLogs = () => {
  return (
    <div className="bg-[#F6F6F5] min-h-screen font-sans">
      
      {/* HEADER */}
      <Header />

      <div className="flex">
        
        {/* SIDEBAR */}
        <Sidebar />

        {/* MAIN CONTENT */}
        <div className="flex-1 p-6">
          
          {/* CARDS */}
          <div className="grid grid-cols-4 gap-6 mb-6">
            <Card
              title="Total logs today"
              value="34"
              subtitle="8 more than yesterday"
              border="border-green-700"
              color="text-green-700"
            />

            <Card
              title="Currently Inside"
              value="12"
              subtitle="As of 1:28 PM"
              border="border-blue-700"
              color="text-blue-700"
            />

            <Card
              title="Already Exited"
              value="22"
              subtitle="32 total - 12 inside"
              border="border-yellow-800"
              color="text-yellow-800"
            />

            <Card
              title="Visitor Types"
              value="Faculty • Alumni • Walk-in"
              subtitle="3 categories logged"
              border="border-yellow-500"
              color="text-yellow-600"
            />
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            
            {/* SEARCH */}
            <div className="relative w-1/3">
              <input
                type="text"
                placeholder="Search by name or purpose..."
                className="border rounded-lg px-4 py-2 w-full"
              />
            </div>

            {/* FILTER BUTTONS */}
            <div className="flex gap-2">
              <FilterButton active>All</FilterButton>
              <FilterButton>Inside</FilterButton>
              <FilterButton>Exited</FilterButton>
            </div>

          </div>

          {/* TABLE */}
          <GuestLogTable data={sampleData}/>

        </div>
      </div>
    </div>
  );
}
export default GuestLogs;

const sampleData = [
  {
    name: "Kyla Payad",
    type: "Faculty",
    purpose: "Book Reference",
    date: "2026-04-01",
    timeIn: "12:01",
    timeOut: null,
    status: "Inside",
  },
  {
    name: "Juan Dela Cruz",
    type: "Alumni",
    purpose: "Research / Thesis",
    date: "2026-04-01",
    timeIn: "12:15",
    timeOut: "12:45",
    status: "Outside",
  },
];
