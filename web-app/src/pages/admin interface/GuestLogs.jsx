import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { buildAvgStayTooltip } from "../../components/AvgStayToolTip";
import GuestLogTable from "../../components/GuestLogTable";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import FilterTabs from "../../components/FilterTabs";
import MonthPicker from "../../components/MonthPicker";
import { authFetch } from "../../auth";
import useChangeWatcher from "../../components/useChangeWatcher";
import {
  BRAND,
  PageTitle,
  KpiCard,
  Pill,
  TrendPill,
  FilterDivider,
  Dialog,
  btn,
} from "../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const STATUS_TABS = ["All", "Inside", "Exited"];
// "Today" comes first and is the default view.
const DATE_TABS = ["Today", "This Week", "This Month", "All Time"];
const VISITOR_TYPE_OPTIONS = [
  { value: "faculty", label: "Faculty" },
  { value: "alumni", label: "Alumni" },
  { value: "walkin", label: "Walk-in" },
  { value: "student", label: "Student" },
];

// Explanations shown on the "i" icons of the KPI cards.
const KPI_TOOLTIPS = {
  totalLogs: "Counts every guest entry log matching your current search, status, visitor type, and date filters.",
  currentlyInside: "Live count of the filtered guest logs currently marked as \"inside\" right now.",
  alreadyExited: "Number of filtered guest logs currently marked as \"exited.\"",
};

// This month as "YYYY-MM" (default + latest choice for the month picker).
const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Admin page listing every guest visit, with filters and a Force Exit button.
const GuestLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [visitorTypeFilter, setVisitorTypeFilter] = useState("All Types");
  const [dateFilter, setDateFilter] = useState("Today");
  const [selectedMonth, setSelectedMonth] = useState(thisMonth);
  // Pop-ups: the "are you sure?" confirm, and the result after force exit.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [exiting, setExiting] = useState(false);

  // Gets every guest visit from the server.
  const fetchLogs = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/guests/all`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  // Loads the guest logs once when the page opens.
  useEffect(() => {
    fetchLogs();
  }, []);

  // Then reloads only when a guest visit changed (log-in, log-out, force exit).
  useChangeWatcher(["guests"], fetchLogs);

  // Every guest still inside (not just the filtered ones) — Force Exit affects all of them.
  const allInside = logs.filter((l) => l.status === "inside").length;

  // "Yes, Force Exit": marks every guest inside as exited (usually at closing time).
  const handleForceExitAll = async () => {
    setExiting(true);
    try {
      const response = await authFetch(`${API_URL}/api/guests/force-exit-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      setConfirmOpen(false);
      if (response.ok) {
        setResult({ tone: "success", title: "Guests Logged Out", message: data.message || "Successfully logged out all active guests." });
        fetchLogs();
      } else {
        setResult({ tone: "error", title: "Force Exit Failed", message: data.message || "Failed to force exit logs." });
      }
    } catch (error) {
      console.error("Force exit error:", error);
      setConfirmOpen(false);
      setResult({ tone: "error", title: "Can't Reach the Server", message: "Please check the connection and try again." });
    } finally {
      setExiting(false);
    }
  };

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

  // Logs that match the search, status, visitor type and date filters.
  const filteredData = logs.filter((log) => {
    const matchesSearch =
      // Staff can still search by name, even though names are hidden in the table.
      (log.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.affiliation || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.purpose || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Inside" && log.status === "inside") ||
      (statusFilter === "Exited" && log.status === "exited");
    const matchesVisitorType = visitorTypeFilter === "All Types" || log.guest_type === visitorTypeFilter;
    return matchesSearch && matchesStatus && matchesVisitorType && isWithinDateFilter(log);
  });

  // KPI numbers (all follow the filters above).
  const currentlyInside = filteredData.filter((l) => l.status === "inside").length;
  const alreadyExited = filteredData.filter((l) => l.status === "exited").length;

  // Average stay: forced exits (Force Exit All / 5:31 PM auto-logout) are left out,
  // since they don't show when the guest really left.
  const exitedLogs = filteredData.filter((l) => l.time_in && l.time_out && !l.forced_exit);
  const totalStayMs = exitedLogs.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStay = exitedLogs.length > 0 ? (totalStayMs / exitedLogs.length / (1000 * 60 * 60)).toFixed(1) : "0.0";
  const forcedExitCount = filteredData.filter((l) => l.time_in && l.time_out && l.forced_exit).length;
  const avgStayTooltip = buildAvgStayTooltip(exitedLogs.length, totalStayMs, avgStay, forcedExitCount);

  // Title of the first card, matching the date tab.
  const totalLogsLabel = {
    "All Time": "Total Logs",
    Today: "Total Logs Today",
    "This Week": "Total Logs This Week",
    "This Month": "Total Logs This Month",
  }[dateFilter];

  // Line under the first card's number: vs yesterday (Today), the month name, or the week.
  let totalLogsFooter;
  if (dateFilter === "Today") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const logsYesterday = logs.filter((l) => l.visit_date && new Date(l.visit_date).toDateString() === yesterday.toDateString());
    const diff = filteredData.length - logsYesterday.length;
    totalLogsFooter = <TrendPill change={diff} suffix={`${Math.abs(diff)} ${diff >= 0 ? "more" : "fewer"} than yesterday`} />;
  } else if (dateFilter === "This Month") {
    const [selYear, selMonth] = selectedMonth.split("-").map(Number);
    totalLogsFooter = (
      <span className="text-xs text-gray-500">
        {new Date(selYear, selMonth - 1, 1).toLocaleString([], { month: "long", year: "numeric" })}
      </span>
    );
  } else if (dateFilter === "This Week") {
    totalLogsFooter = <span className="text-xs text-gray-500">Sunday – Saturday, this week</span>;
  } else {
    totalLogsFooter = <span className="text-xs text-gray-500">{logs.length} records overall</span>;
  }

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          <PageTitle
            title="Guest Logs"
            subtitle="Guests' library entry and exit records."
            right={
              allInside > 0 && (
                <button onClick={() => setConfirmOpen(true)} className={btn.dangerSoft}>
                  Force Exit All Inside ({allInside})
                </button>
              )
            }
          />

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            <KpiCard
              label={totalLogsLabel}
              value={filteredData.length}
              color={BRAND.green}
              tooltip={KPI_TOOLTIPS.totalLogs}
              footer={totalLogsFooter}
            />
            <KpiCard
              label="Currently Inside"
              value={currentlyInside}
              color={BRAND.green}
              tooltip={KPI_TOOLTIPS.currentlyInside}
              footer={
                <div className="flex items-center gap-2">
                  <Pill tone="green" dot>LIVE</Pill>
                  <span className="text-xs text-gray-500">
                    As of {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              }
            />
            <KpiCard
              label="Already Exited"
              value={alreadyExited}
              color={BRAND.goldText}
              tooltip={KPI_TOOLTIPS.alreadyExited}
              footer={<span className="text-xs text-gray-500">{filteredData.length} total · {currentlyInside} inside</span>}
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
              placeholder="Search by name, affiliation or purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FilterTabs options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />
            <FilterSelect value={visitorTypeFilter} onChange={(e) => setVisitorTypeFilter(e.target.value)}>
              <option value="All Types">All Visitor Types</option>
              {VISITOR_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </FilterSelect>

            <FilterDivider />

            <FilterTabs options={DATE_TABS} value={dateFilter} onChange={setDateFilter} />
            {dateFilter === "This Month" && (
              <MonthPicker value={selectedMonth} max={thisMonth()} onChange={(e) => setSelectedMonth(e.target.value)} />
            )}
          </div>

          <GuestLogTable data={filteredData} />
        </main>
      </div>

      {/* "Are you sure?" pop-up */}
      <Dialog
        open={confirmOpen}
        tone="warning"
        title="Force Exit All Guests?"
        message={`This will log out all ${allInside} guest(s) still inside. It's usually done at closing time. These exits won't count toward the average stay.`}
        footer={
          <>
            <button onClick={() => setConfirmOpen(false)} disabled={exiting} className={btn.secondary}>
              Cancel
            </button>
            <button onClick={handleForceExitAll} disabled={exiting} className={btn.danger}>
              {exiting ? "Logging out..." : "Yes, Force Exit"}
            </button>
          </>
        }
      />

      {/* Result pop-up */}
      <Dialog
        open={!!result}
        tone={result?.tone}
        title={result?.title}
        message={result?.message}
        footer={
          <button onClick={() => setResult(null)} className={btn.primary}>
            OK
          </button>
        }
      />
    </div>
  );
};

export default GuestLogs;
