import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import FilterTabs from "../../components/FilterTabs";
import { authFetch } from "../../auth";
import useChangeWatcher from "../../components/useChangeWatcher";
import { BRAND } from "../../components/AdminUI";
import StudentRegistrationsPanel from "./panels/StudentRegistrationsPanel";
import FacultyRegistrationsPanel from "./panels/FacultyRegistrationsPanel";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TYPES = ["Students", "Faculty"];

// Registrations: one page for both kinds of accounts. The switch at the top picks
// which list the admin is working on; the small numbers show what is waiting in each.
const Registrations = () => {
  // Remembered for this browser tab, so a reload keeps the same view.
  const [type, setType] = useState(() => sessionStorage.getItem("registrations_type") || "Students");
  const [waiting, setWaiting] = useState({});

  const choose = (value) => {
    setType(value);
    sessionStorage.setItem("registrations_type", value);
  };

  // How many registrations are waiting for review in each list.
  const fetchWaiting = async () => {
    try {
      const [studentsRes, facultyRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/pending`),
        authFetch(`${API_URL}/api/admin/faculty/registrations`),
      ]);
      const students = await studentsRes.json();
      const faculty = await facultyRes.json();
      setWaiting({
        Students: Array.isArray(students) ? students.length : 0,
        Faculty: Array.isArray(faculty) ? faculty.filter((r) => r.approval_status === "pending").length : 0,
      });
    } catch {
      // the next change check will try again
    }
  };
  useEffect(() => { fetchWaiting(); }, []);
  useChangeWatcher(["registrations"], fetchWaiting, { fullRefreshMs: 0 });

  // The Students | Faculty switch is shown on the right of the page title (each panel places it).
  const switcher = <FilterTabs options={TYPES} value={type} onChange={choose} counts={waiting} />;

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          {type === "Students" ? <StudentRegistrationsPanel switcher={switcher} /> : <FacultyRegistrationsPanel switcher={switcher} />}
        </main>
      </div>
    </div>
  );
};

export default Registrations;