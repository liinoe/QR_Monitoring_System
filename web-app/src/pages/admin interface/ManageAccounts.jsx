import React, { useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import FilterTabs from "../../components/FilterTabs";
import { BRAND } from "../../components/AdminUI";
import StudentAccountsPanel from "./panels/StudentAccountsPanel";
import FacultyAccountsPanel from "./panels/FacultyAccountsPanel";

const TYPES = ["Students", "Faculty"];

// Manage Accounts: correct the details of approved accounts. The switch at the top
// picks students or faculty.
const ManageAccounts = () => {
  const [type, setType] = useState(() => sessionStorage.getItem("accounts_type") || "Students");

  const choose = (value) => {
    setType(value);
    sessionStorage.setItem("accounts_type", value);
  };

  // The Students | Faculty switch is shown on the right of the page title (each panel places it).
  const switcher = <FilterTabs options={TYPES} value={type} onChange={choose} />;

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          {type === "Students" ? <StudentAccountsPanel switcher={switcher} /> : <FacultyAccountsPanel switcher={switcher} />}
        </main>
      </div>
    </div>
  );
};

export default ManageAccounts;