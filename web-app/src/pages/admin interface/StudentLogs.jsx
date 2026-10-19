import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { buildAvgStayTooltip } from "../../components/AvgStayToolTip";
import StudentLogTable from "../../components/StudentLogTable";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import FilterTabs from "../../components/FilterTabs";
import MonthPicker from "../../components/MonthPicker";
import { authFetch } from "../../auth";
import useChangeWatcher from "../../components/useChangeWatcher";
import {
  BRAND,
  COLLEGE_COLORS,
  PageTitle,
  KpiCard,
  Pill,
  FilterDivider,
} from "../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// "Today" comes first and is the default view.
const DATE_OPTIONS = ["Today", "This Week", "This Month", "All Time"];
const STATUS_TABS = ["All", "Inside", "Exited"];

// College codes for the filter dropdown, A–Z.
const COLLEGE_OPTIONS = Object.keys(COLLEGE_COLORS);

// Full college names → short codes.
const COLLEGE_ACRONYMS = {
  "college of agriculture, food, environment and natural resources": "CAFENR",
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
  "college of advanced and professional studies": "CAPS",
};

// Turns a full college name into its code (e.g. "College of Nursing" → "CON").
const toAcronym = (college) => {
  if (!college) return "N/A";
  const key = college.trim().toLowerCase();
  return COLLEGE_ACRONYMS[key] || college;
};

// Explanations shown on the "i" icons of the KPI cards.
const KPI_TOOLTIPS = {
  totalLogs: "Counts every student entry log matching your current search, college, status, and date filters.",
  currentlyInside: "Live count of the filtered logs currently marked as \"inside\" right now.",
  totalExits: "Number of filtered logs currently marked as \"exited.\"",
};

// This month as "YYYY-MM" (default + latest choice for the month picker).
const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Admin page listing every student entry/exit, with filters. (Force Exit All is on the Dashboard.)
const StudentLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("Today");
  const [selectedMonth, setSelectedMonth] = useState(thisMonth);

  // Gets every student log from the server.
  const fetchLogs = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/logs/all`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  // Loads the logs once when the page opens.
  useEffect(() => {
    fetchLogs();
  }, []);

  // Then reloads only when a log changed (entry, exit, force exit) or a student's
  // info was edited (names / colleges shown in the table).
  useChangeWatcher(["logs", "students"], fetchLogs);


  // True if a log falls inside the selected date tab (Today / This Week / chosen month).
  const isWithinDateFilter = (log) => {
    if (dateFilter === "All Time") return true;
    if (!log.visit_date) return false;
    const logDate = new Date(log.visit_date);
    const now = new Date();

    if (dateFilter === "Today") return logDate.toDateString() === now.toDateString();

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
      return logDate.getMonth() === selMonth - 1 && logDate.getFullYear() === selYear;
    }
    return true;
  };

  // Logs that match the search, college, status and date filters.
  const filteredData = logs.filter((log) => {
    const matchesSearch =
      (log.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.student_number || "").includes(searchTerm);
    const matchesCollege = collegeFilter === "All Colleges" || toAcronym(log.college) === collegeFilter;
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Inside" && log.status === "inside") ||
      (statusFilter === "Exited" && log.status === "exited");
    return matchesSearch && matchesCollege && matchesStatus && isWithinDateFilter(log);
  });

  // KPI numbers (all follow the filters above).
  const totalFiltered = filteredData.length;
  const currentlyInside = filteredData.filter((l) => l.status === "inside").length;
  const totalExits = filteredData.filter((l) => l.status === "exited").length;

  // Average stay: forced exits (Force Exit All / 5:31 PM auto-logout) are left out,
  // since they don't show when the student really left.
  const exitedLogs = filteredData.filter((l) => l.time_in && l.time_out && !l.forced_exit);
  const totalStayMs = exitedLogs.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStay = exitedLogs.length > 0 ? (totalStayMs / exitedLogs.length / (1000 * 60 * 60)).toFixed(1) : "0.0";
  const forcedExitCount = filteredData.filter((l) => l.time_in && l.time_out && l.forced_exit).length;
  const avgStayTooltip = buildAvgStayTooltip(exitedLogs.length, totalStayMs, avgStay, forcedExitCount);

  const dateSuffix = { "All Time": "", Today: " Today", "This Week": " This Week", "This Month": " This Month" }[dateFilter];

  // Small gray line under the numbers, matching the date tab.
  const periodSubtitle = {
    "All Time": "All-time total",
    Today: "Updated today",
    "This Week": "Sunday – Saturday, this week",
    "This Month": (() => {
      const [selYear, selMonth] = selectedMonth.split("-").map(Number);
      return new Date(selYear, selMonth - 1, 1).toLocaleString([], { month: "long", year: "numeric" });
    })(),
  }[dateFilter];

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          <PageTitle
            title="Student Logs"
            subtitle="Students' library entry and exit records."
          />

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            <KpiCard
              label={`Total Logs${dateSuffix}`}
              value={totalFiltered}
              color={BRAND.green}
              tooltip={KPI_TOOLTIPS.totalLogs}
              footer={<span className="text-xs text-gray-500">{periodSubtitle}</span>}
            />
            <KpiCard
              label="Currently Inside"
              value={currentlyInside}
              color={BRAND.green}
              tooltip={KPI_TOOLTIPS.currentlyInside}
              footer={<Pill tone="green" dot>LIVE</Pill>}
            />
            <KpiCard
              label={`Total Exits${dateSuffix}`}
              value={totalExits}
              color={BRAND.goldText}
              tooltip={KPI_TOOLTIPS.totalExits}
              footer={<span className="text-xs text-gray-500">{periodSubtitle}</span>}
            />
            <KpiCard
              label="Avg. Stay Duration"
              value={avgStay}
              unit="hr"
              color={BRAND.deep}
              tooltip={avgStayTooltip}
              footer={<span className="text-xs text-gray-500">Based on exits</span>}
            />
          </div>

          {/* SEARCH AND FILTERS */}
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search by name or student no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FilterTabs options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />
            <FilterSelect value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
              <option value="All Colleges">All Colleges</option>
              {COLLEGE_OPTIONS.map((college) => (
                <option key={college} value={college}>{college}</option>
              ))}
            </FilterSelect>

            <FilterDivider />

            <FilterTabs options={DATE_OPTIONS} value={dateFilter} onChange={setDateFilter} />
            {dateFilter === "This Month" && (
              <MonthPicker value={selectedMonth} max={thisMonth()} onChange={(e) => setSelectedMonth(e.target.value)} />
            )}
          </div>

          <StudentLogTable
            data={filteredData.map((log) => ({
              program: log.program || "",
              studentNo: log.student_number || "---",
              college: toAcronym(log.college),
              date: log.visit_date ? new Date(log.visit_date).toLocaleDateString() : "---",
              timeIn: log.time_in ? new Date(log.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "---",
              timeOut: log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "---",
              inside: log.status === "inside",
              forced: !!log.forced_exit,
            }))}
          />
        </main>
      </div>

    </div>
  );
};

export default StudentLogs;
