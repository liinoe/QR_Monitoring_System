import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import StudentLogTable from "../../components/StudentLogTable";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DATE_OPTIONS = ["All Time", "Today", "This Week", "This Month"];

const StudentLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [dateFilter, setDateFilter] = useState("All Time");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${mm}`; // "YYYY-MM"
  });

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
    "college of agriculture, food, environment and natural resources": "CAFENR",
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

  // DATE RANGE HELPER
  const isWithinDateFilter = (log) => {
    if (dateFilter === "All Time") return true;
    if (!log.visit_date) return false;

    const logDate = new Date(log.visit_date);
    const now = new Date();

    if (dateFilter === "Today") {
      return logDate.toDateString() === now.toDateString();
    }

    if (dateFilter === "This Week") {
      // Start of week (Sunday) at 00:00:00
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      // End of week (Saturday) at 23:59:59
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return logDate >= startOfWeek && logDate <= endOfWeek;
    }

    if (dateFilter === "This Month") {
      const [selYear, selMonth] = selectedMonth.split("-").map(Number);
      return (
        logDate.getMonth() === selMonth - 1 &&
        logDate.getFullYear() === selYear
      );
    }

    return true;
  };

  // FILTER
  const filteredData = logs.filter(log => {
    const matchesSearch = (log.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (log.student_number || "").includes(searchTerm);
    const matchesCollege = collegeFilter === "All Colleges" || toAcronym(log.college) === collegeFilter;
    const matchesStatus = statusFilter === "All Status" || (statusFilter === "Active" && log.status === "inside") || (statusFilter === "Inactive" && log.status === "exited");
    const matchesDate = isWithinDateFilter(log);
    return matchesSearch && matchesCollege && matchesStatus && matchesDate;
  });

  // STATS CALCULATIONS — all derived from filteredData so cards react to college, status, search, and date filters
  const totalFiltered = filteredData.length;
  const currentlyInside = filteredData.filter(l => l.status === 'inside').length;
  const totalExits = filteredData.filter(l => l.status === 'exited').length;

  const exitedLogs = filteredData.filter(l => l.time_in && l.time_out);
  const totalStayMs = exitedLogs.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStay = exitedLogs.length > 0 ? (totalStayMs / exitedLogs.length / (1000 * 60 * 60)).toFixed(1) : "0.0";

  // Labels/subtitles for the first two cards, matching the active date filter
  const dateSuffix = {
    "All Time": "",
    "Today": " today",
    "This Week": " this week",
    "This Month": " this month",
  }[dateFilter];

  const periodSubtitle = {
    "All Time": "All-time total",
    "Today": "Updated today",
    "This Week": "Sunday – Saturday, this week",
    "This Month": (() => {
      const [selYear, selMonth] = selectedMonth.split("-").map(Number);
      return new Date(selYear, selMonth - 1, 1).toLocaleString([], { month: 'long', year: 'numeric' });
    })(),
  }[dateFilter];

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
            <Card title={`Total logs${dateSuffix}`} value={totalFiltered} subtitle={periodSubtitle} color="text-green-700" border="border-green-700" />
            <Card title="Currently Inside" value={currentlyInside} subtitle="Live status" color="text-blue-700" border="border-blue-700" />
            <Card title={`Total exits${dateSuffix}`} value={totalExits} subtitle={periodSubtitle} color="text-orange-700" border="border-orange-700" />
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
              <select className="border px-4 py-2 rounded-lg bg-white text-gray-600" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                {DATE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {dateFilter === "This Month" && (
                <input
                  type="month"
                  value={selectedMonth}
                  max={(() => {
                    const now = new Date();
                    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                  })()}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border px-4 py-2 rounded-lg bg-white text-gray-600"
                />
              )}
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