import React from "react";
import Sidebar from "../components/Sidebar";
import Card from "../components/Card";
import FilterButton from "../components/FilterButton";
import RegistrationItem from "../components/RegistrationItem";

const Registrations = () => {
  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">

      {/* HEADER */}
      <div className="w-full h-[140px] bg-[#1B651B] border-b-[5px] border-[#D4A017] relative flex-shrink-0">
        <img
          src="https://placehold.co/94x82"
          alt="logo"
          className="w-[94px] h-[82px] absolute left-[29px] top-[28px]"
        />

        <h1 className="absolute left-[150px] top-[40px] text-white text-[30px] font-bold">
          Library Patron Access and Monitoring System
        </h1>

        <p className="absolute left-[153px] top-[82px] text-white text-[15px]">
          CvSU - Main Campus Library
        </p>

        <p className="absolute right-[150px] top-[58px] text-white text-[20px]">
          Friday, Apr 3, 2026
        </p>

        <div className="w-[60px] h-[56px] bg-[#539C7FBA] rounded-full absolute right-[40px] top-[40px]" />
        <span className="absolute right-[58px] top-[50px] text-white text-[30px] font-bold">
          K
        </span>
      </div>

      {/* BODY */}
      <div className="flex flex-1">

        {/* SIDEBAR */}
        <Sidebar />

        {/* MAIN CONTENT */}
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px]">

          {/* DESCRIPTION */}
          <p className="text-[#666]">
            Approve, reject, or review pending student registrations.
          </p>

          {/* CARDS */}
          <div className="grid grid-cols-4 gap-[20px]">

            <Card title="Pending" value="20" color="text-[#E76D22]" border="border-[#E76D22]" />
            <Card title="Approved" value="213" color="text-[#1B651B]" border="border-[#1B651B]" />
            <Card title="Rejected" value="10" color="text-[#812022]" border="border-[#812022]" />
            <Card title="This Semester" value="453" color="text-[#225276]" border="border-[#225276]" />

          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-4 items-center">

            <input
              type="text"
              placeholder="Search students..."
              className="border px-4 py-2 rounded w-[250px]"
            />

            <div className="flex gap-2">
              <FilterButton active>All</FilterButton>
              <FilterButton>Pending</FilterButton>
              <FilterButton>Approved</FilterButton>
              <FilterButton>Rejected</FilterButton>
            </div>

            <select className="border px-3 py-2 rounded">
              <option>All Colleges</option>
            </select>

          </div>

          {/* LIST */}
          <div className="space-y-[15px]">

            <RegistrationItem
              name="Juan dela Cruz"
              details="202302075 - BSIT 3-1 - CEIT"
              date="Submitted: April 4, 2026 1:21 PM"
              status="Pending"
            />

            <RegistrationItem
              name="Kyla Red"
              details="202302075 - BSN 3-2 - CON"
              date="Submitted: April 4, 2026 12:21 PM"
              status="Pending"
            />

            <RegistrationItem
              name="Lhanz Hubilla"
              details="202302075 - BSIT 3-3 - CEIT"
              date="Approved: April 4, 2026 - QR Issued"
              status="Approved"
            />

            <RegistrationItem
              name="Rainiel Maranan"
              details="202302075 - BSIT 3-3 - CEIT"
              date="Reason: Duplicate student number"
              status="Rejected"
            />

          </div>

          {/* FOOTER */}
          <p className="text-[#666] text-sm">
            Showing 5 of 453 registrations
          </p>

        </div>
      </div>
    </div>
  );
};

export default Registrations;
