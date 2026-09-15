import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import SearchInput from "../../components/SearchInput";
import FilterTabs from "../../components/FilterTabs";
import MonthPicker from "../../components/MonthPicker";
import GuestLogTable from "../../components/GuestLogTable";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const STATUS_TABS = ["All", "Inside", "Exited"];
const DATE_TABS = ["All Time", "Today", "This Week", "This Month"];

const GuestLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All Time");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${mm}`; // "YYYY-MM"
  });

  const fetchLogs = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/guests/all`);
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
    const confirm = window.confirm(`Are you sure you want to force exit all ${currentlyInside} currently active guest(s)? This is usually done at library closing time.`);
    if (confirm) {
      try {
        const response = await authFetch(`${API_URL}/api/guests/force-exit-all`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (response.ok) {
          alert(data.message || "Successfully logged out all active guests.");
          fetchLogs(); // Refresh the table to show the new exits
        } else {
          alert(data.message || "Failed to force exit logs.");
        }
      } catch (error) {
        console.error("Force exit error:", error);
      }
    }
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
    const matchesSearch =
      (log.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.purpose || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Inside" && log.status === 'inside') ||
      (statusFilter === "Exited" && log.status === 'exited');
    const matchesDate = isWithinDateFilter(log);
    return matchesSearch && matchesStatus && matchesDate;
  });

  // KPI STATS — all derived from filteredData so cards react to search + status + date filters
  const currentlyInside = filteredData.filter(l => l.status === 'inside').length;
  const alreadyExited = filteredData.filter(l => l.status === 'exited').length;

  const visitorTypesPresent = Array.from(new Set(filteredData.map(l => l.guest_type).filter(Boolean)))
    .map(t => t.charAt(0).toUpperCase() + t.slice(1));

  // Label for the first card, matches the active date tab
  const totalLogsLabel = {
    "All Time": "Total logs",
    "Today": "Total logs today",
    "This Week": "Total logs this week",
    "This Month": "Total logs this month",
  }[dateFilter];

  // Comparison subtitle: only meaningful for "Today", since prior-period math
  // for arbitrary weeks/months would need extra data we don't have here.
  let totalLogsSubtitle;
  if (dateFilter === "Today") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const logsYesterday = logs.filter(
      l => l.visit_date && new Date(l.visit_date).toDateString() === yesterday.toDateString()
    );
    const vsYesterday = filteredData.length - logsYesterday.length;
    totalLogsSubtitle = `${vsYesterday >= 0 ? '↑' : '↓'} ${Math.abs(vsYesterday)} ${vsYesterday >= 0 ? 'more' : 'fewer'} than yesterday`;
  } else if (dateFilter === "This Month") {
    const [selYear, selMonth] = selectedMonth.split("-").map(Number);
    const monthLabel = new Date(selYear, selMonth - 1, 1).toLocaleString([], { month: 'long', year: 'numeric' });
    totalLogsSubtitle = monthLabel;
  } else if (dateFilter === "This Week") {
    totalLogsSubtitle = "Sunday – Saturday, this week";
  } else {
    totalLogsSubtitle = `${logs.length} records overall`;
  }

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px]">

          {/* HEADER SECTION WITH BULK ACTION BUTTON */}
          <div className="flex justify-between items-start text-[#666] text-[16px]">
            <div>
              <p>Guests library entry and exit records.</p>
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

          {/* KPI CARDS */}
          <div className="grid grid-cols-4 gap-[20px]">
            <Card
              title={totalLogsLabel}
              value={filteredData.length}
              subtitle={totalLogsSubtitle}
              color="text-green-700"
              border="border-green-700"
            />
            <Card
              title="Currently Inside"
              value={currentlyInside}
              subtitle={`As of ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              color="text-blue-700"
              border="border-blue-700"
            />
            <Card
              title="Already Exited"
              value={alreadyExited}
              subtitle={`${filteredData.length} total - ${currentlyInside} inside`}
              color="text-amber-800"
              border="border-amber-800"
            />
            <Card
              title="Visitor Types"
              value={visitorTypesPresent.length > 0 ? visitorTypesPresent.join(" • ") : "No data yet"}
              subtitle={`${visitorTypesPresent.length} categories logged`}
              color="text-yellow-600"
              border="border-yellow-500"
            />
          </div>

          {/* SEARCH AND FILTERS */}
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search by name or purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <FilterTabs options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />

            {/* Divider between status and date filters */}
            <div className="h-6 w-px bg-gray-300 mx-1" />

            <FilterTabs options={DATE_TABS} value={dateFilter} onChange={setDateFilter} />

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

          <GuestLogTable data={filteredData} />
        </div>
      </div>
    </div>
  );
};

export default GuestLogs;