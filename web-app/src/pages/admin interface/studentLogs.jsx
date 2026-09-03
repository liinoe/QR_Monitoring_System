import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import StudentLogTable from "../../components/StudentLogTable";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const StudentLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const fetchLogs = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/logs/all`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (log_id) => {
    const reason = prompt("Enter the reason for deleting this log entry:");
    if (reason !== null && reason.trim() !== "") {
      try {
        // this endpoint requires super_admin — a regular admin will get
        // a 403 here, which is expected.
        const response = await authFetch(`${API_URL}/api/logs/delete/${log_id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });
        if (response.ok) {
          fetchLogs();
        } else {
          const data = await response.json();
          alert(data.message || "Failed to delete log.");
        }
      } catch (error) {
        console.error("Delete error:", error);
      }
    }
  };

  // STATS CALCULATIONS
  const todayStr = new Date().toDateString();
  const logsToday = logs.filter(l => new Date(l.visit_date).toDateString() === todayStr);
  const totalToday = logsToday.length;
  const currentlyInside = logs.filter(l => l.status === 'inside').length;
  const totalExitsToday = logsToday.filter(l => l.status === 'exited').length;

  const exitedLogs = logs.filter(l => l.time_in && l.time_out);
  const totalStayMs = exitedLogs.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStay = exitedLogs.length > 0 ? (totalStayMs / exitedLogs.length / (1000 * 60 * 60)).toFixed(1) : "0.0";

  const collegeOptions = [
    "CAFENR",
    "CAS",
    "CCJ",
    "CED",
    "CEIT",
    "CEMDS",
    "CON",
    "CSPEAR",
    "CTHM",
    "CVMBS",
    "COM",
    "CAPS"
  ];

  const COLLEGE_ACRONYMS = {
    "college of agriculture, food, environment, and natural resources": "CAFENR",
    "college of agriculture, forestry, environment and natural resources": "CAFENR",
    "college of arts and sciences": "CAS",
    "college of criminal justice": "CCJ",
    "college of education": "CED",
    "college of engineering and information technology": "CEIT",
    "college of economics, management, and development studies": "CEMDS",
    "college of economics, management and development studies": "CEMDS",
    "college of nursing": "CON",
    "college of sports, physical education and recreation": "CSPEAR",
    "college of tourism and hospitality management": "CTHM",
    "college of veterinary medicine and biomedical sciences": "CVMBS",
    "college of medicine": "COM",
    "college of advanced and professional studies": "CAPS"
  };

  const toAcronym = (college) => {
    if (!college) return "N/A";
    const key = college.trim().toLowerCase();
    return COLLEGE_ACRONYMS[key] || college;
  };

  // FILTER
  const filteredData = logs.filter(log => {
    const matchesSearch = (log.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (log.student_number || "").includes(searchTerm);
    const matchesCollege = collegeFilter === "All Colleges" || toAcronym(log.college) === collegeFilter;
    const matchesStatus = statusFilter === "All Status" || (statusFilter === "Active" && log.status === "inside") || (statusFilter === "Inactive" && log.status === "exited");
    return matchesSearch && matchesCollege && matchesStatus;
  });

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px]">
          <div className="flex justify-between items-center text-[#666] text-[16px]">
            <p>All library entry and exit records.</p>
            <p>1st Semester A.Y. 2025-2026</p>
          </div>

          {/* DYNAMIC CARDS */}
          <div className="grid grid-cols-4 gap-[20px]">
            <Card title="Total logs today" value={totalToday} subtitle="Updated today" color="text-green-700" border="border-green-700" />
            <Card title="Currently Inside" value={currentlyInside} subtitle="Live status" color="text-blue-700" border="border-blue-700" />
            <Card title="Total exits today" value={totalExitsToday} subtitle="Updated today" color="text-orange-700" border="border-orange-700" />
            <Card title="Avg. Stay Duration" value={`${avgStay} hr`} subtitle="Based on exits" color="text-emerald-700" border="border-emerald-700" />
          </div>

          {/* SEARCH AND FILTERS */}
          <div className="flex justify-between items-center">
            <div className="relative">
              <input type="text" placeholder="Search by name or student no..." className="pl-10 pr-4 py-2 border rounded-lg w-[320px] bg-white outline-none focus:ring-1 focus:ring-green-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <select className="border px-4 py-2 rounded-lg bg-white text-gray-600" value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
                <option>All Colleges</option>
                {collegeOptions.map((college) => (
                  <option key={college} value={college}>{college}</option>
                ))}
              </select>
              <select className="border px-4 py-2 rounded-lg bg-white text-gray-600" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option>All Status</option>
                <option value="Active">Active / Entry</option>
                <option value="Inactive">Inactive / Exit</option>
              </select>
            </div>
          </div>

          <StudentLogTable data={filteredData.map(log => ({
            studentNo: log.student_number || "---",
            name: log.full_name || "Unknown",
            college: toAcronym(log.college),
            date: log.visit_date ? new Date(log.visit_date).toLocaleDateString() : "---",
            time: log.time_in ? new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---",
            type: log.status === 'inside' ? 'Entry' : 'Exit',
            status: log.status === 'inside' ? 'Active' : 'Inactive',
            action: <button onClick={() => handleDelete(log.log_id)} className="text-red-500 font-bold hover:text-red-700">Delete</button>
          }))} />
        </div>
      </div>
    </div>
  );
};

export default StudentLogs;