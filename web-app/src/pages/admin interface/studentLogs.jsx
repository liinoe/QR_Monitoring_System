import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import KpiTooltipCard from "../../components/KpiTooltipCard";
import { buildAvgStayTooltip } from "../../components/AvgStayToolTip";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import FilterTabs from "../../components/FilterTabs";
import MonthPicker from "../../components/MonthPicker";
import StudentLogTable from "../../components/StudentLogTable";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DATE_OPTIONS = ["All Time", "Today", "This Week", "This Month"];
const STATUS_TABS = ["All", "Active", "Inactive"];

const KPI_TOOLTIPS = {
  totalLogs: "Counts every student entry log matching your current search, college, status, and date filters.",
  currentlyInside: "Live count of the filtered logs currently marked as \"inside\" right now.",
  totalExits: "Number of filtered logs currently marked as \"exited.\"",
};

const StudentLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All Time");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${mm}`; 
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

  // BULK FORCE EXIT FUNCTION
  const handleForceExitAll = async () => {
    const confirm = window.confirm(`Are you sure you want to force exit all ${currentlyInside} currently active student(s)? This is usually done at library closing time.`);
    if (confirm) {
      try {
        const response = await authFetch(`${API_URL}/api/logs/force-exit-all`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (response.ok) {
          alert(data.message);
          fetchLogs(); // Refresh the table to show the new exits
        } else {
          alert(data.message || "Failed to force exit logs.");
        }
      } catch (error) {
        console.error("Force exit error:", error);
      }
    }
  };

  const collegeOptions = [
    "CAFENR", "CAS", "CCJ", "CED", "CEIT", "CEMDS", 
    "CON", "CSPEAR", "CTHM", "CVMBS", "COM", "CAPS"
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

  const isWithinDateFilter = (log) => {
    if (dateFilter === "All Time") return true;
    if (!log.visit_date) return false;

    const logDate = new Date(log.visit_date);
    const now = new Date();

    if (dateFilter === "Today") {
      return logDate.toDateString() === now.toDateString();
    }

    if (dateFilter === "This Week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

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

  const filteredData = logs.filter(log => {
    const matchesSearch = (log.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (log.student_number || "").includes(searchTerm);
    const matchesCollege = collegeFilter === "All Colleges" || toAcronym(log.college) === collegeFilter;
    const matchesStatus = statusFilter === "All" || 
                          (statusFilter === "Active" && log.status === "inside") || 
                          (statusFilter === "Inactive" && log.status === "exited");
    const matchesDate = isWithinDateFilter(log);
    return matchesSearch && matchesCollege && matchesStatus && matchesDate;
  });

  const totalFiltered = filteredData.length;
  const currentlyInside = filteredData.filter(l => l.status === 'inside').length;
  const totalExits = filteredData.filter(l => l.status === 'exited').length;

  const exitedLogs = filteredData.filter(l => l.time_in && l.time_out && !l.forced_exit);
  const totalStayMs = exitedLogs.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStay = exitedLogs.length > 0 ? (totalStayMs / exitedLogs.length / (1000 * 60 * 60)).toFixed(1) : "0.0";
  const forcedExitCount = filteredData.filter(l => l.time_in && l.time_out && l.forced_exit).length;
  const avgStayTooltip = buildAvgStayTooltip(exitedLogs.length, totalStayMs, avgStay, forcedExitCount);

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
          
          {/* HEADER SECTION WITH BULK ACTION BUTTON */}
          <div className="flex justify-between items-start text-[#666] text-[16px]">
            <div>
              <p>Students library entry and exit records.</p>
            </div>
            {currentlyInside > 0 && (
              <button 
                onClick={handleForceExitAll} 
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2"
              >
                Force Exit All Active ({currentlyInside})
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-[20px]">
            <KpiTooltipCard tooltip={KPI_TOOLTIPS.totalLogs} title={`Total Logs${dateSuffix}`} value={totalFiltered} subtitle={periodSubtitle} color="text-green-700" border="border-green-700" />
            <KpiTooltipCard tooltip={KPI_TOOLTIPS.currentlyInside} title="Currently Inside" value={currentlyInside} subtitle="Live status" color="text-blue-700" border="border-blue-700" />
            <KpiTooltipCard tooltip={KPI_TOOLTIPS.totalExits} title={`Total Exits${dateSuffix}`} value={totalExits} subtitle={periodSubtitle} color="text-orange-700" border="border-orange-700" />
            <KpiTooltipCard tooltip={avgStayTooltip} title="Avg. Stay Duration" value={`${avgStay} hr`} subtitle="Based on exits" color="text-emerald-700" border="border-emerald-700" />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search by name or student no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <FilterTabs options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />

            <FilterSelect value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
              <option value="All Colleges">All Colleges</option>
              {collegeOptions.map((college) => (
                <option key={college} value={college}>{college}</option>
              ))}
            </FilterSelect>

            {/* Divider between status/college and date filters */}
            <div className="h-6 w-px bg-gray-300 mx-1" />

            <FilterTabs options={DATE_OPTIONS} value={dateFilter} onChange={setDateFilter} />

            {dateFilter === "This Month" && (
              <MonthPicker
                value={selectedMonth}
                max={(() => {
                  const now = new Date();
                  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                })()}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            )}
          </div>

          <StudentLogTable data={filteredData.map(log => ({
            studentNo: log.student_number || "---",
            college: toAcronym(log.college),
            date: log.visit_date ? new Date(log.visit_date).toLocaleDateString() : "---",
            timeIn: log.time_in ? new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---",
            timeOut: log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---",
            status: log.status === 'inside' ? 'Active' : 'Inactive'
          }))} />
        </div>
      </div>
    </div>
  );
};

export default StudentLogs;