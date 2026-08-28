import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import GuestLogTable from "../../components/GuestLogTable";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const STATUS_TABS = ["All", "Inside", "Exited"];

const GuestLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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

  const handleMarkExited = async (log_id) => {
    try {
      const response = await authFetch(`${API_URL}/api/guests/exit/${log_id}`, { method: 'PATCH' });
      if (response.ok) fetchLogs();
    } catch (error) {
      console.error("Exit error:", error);
    }
  };

  // STATS
  const todayStr = new Date().toDateString();
  const logsToday = logs.filter(l => l.visit_date && new Date(l.visit_date).toDateString() === todayStr);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const logsYesterday = logs.filter(l => l.visit_date && new Date(l.visit_date).toDateString() === yesterday.toDateString());
  const vsYesterday = logsToday.length - logsYesterday.length;

  const currentlyInside = logs.filter(l => l.status === 'inside').length;
  const alreadyExited = logs.filter(l => l.status === 'exited').length;

  const visitorTypesPresent = Array.from(new Set(logs.map(l => l.guest_type).filter(Boolean)))
    .map(t => t.charAt(0).toUpperCase() + t.slice(1));

  // FILTER
  const filteredData = logs.filter(log => {
    const matchesSearch =
      (log.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.purpose || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Inside" && log.status === 'inside') ||
      (statusFilter === "Exited" && log.status === 'exited');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px]">

          {/* KPI CARDS */}
          <div className="grid grid-cols-4 gap-[20px]">
            <Card
              title="Total logs today"
              value={logsToday.length}
              subtitle={`${vsYesterday >= 0 ? '↑' : '↓'} ${Math.abs(vsYesterday)} ${vsYesterday >= 0 ? 'more' : 'fewer'} than yesterday`}
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
              subtitle={`${logs.length} total - ${currentlyInside} inside`}
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
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or purpose..."
                className="pl-4 pr-4 py-2 border rounded-lg w-[320px] bg-white outline-none focus:ring-1 focus:ring-green-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === tab
                      ? "bg-[#1B651B] text-white"
                      : "bg-white text-gray-600 border hover:bg-gray-50"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <GuestLogTable data={filteredData} onMarkExited={handleMarkExited} />
        </div>
      </div>
    </div>
  );
};

export default GuestLogs;