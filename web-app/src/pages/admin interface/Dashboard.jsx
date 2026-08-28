import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList } from "recharts";
import Sidebar from "../../components/Sidebar";
import Card from "../../components/Card";
import Header from "../../components/Header";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const COLLEGES = ['CAFENR', 'CAS', 'CCJ', 'CED', 'CEIT', 'CEMDS', 'CON', 'CSPEAR', 'CTHM', 'CVMBS'];
const COLORS = ['#16a34a', '#ca8a04', '#9333ea', '#2563eb', '#ea580c', '#e11d48', '#dc2626', '#7f1d1d', '#f97316', '#db2777'];

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
};

const toAcronym = (college) => {
  if (!college) return null;
  const key = college.trim().toLowerCase();
  return COLLEGE_ACRONYMS[key] || college.trim().toUpperCase();
};

const getWeekRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const Dashboard = () => {
  const [logs, setLogs] = useState([]);
  const [guestLogs, setGuestLogs] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchDashboardData = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/logs/all`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) { console.error("Fetch error:", error); }
  };

  const fetchGuestData = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/guests/all`);
      const data = await response.json();
      setGuestLogs(Array.isArray(data) ? data : []);
    } catch (error) { console.error("Guest fetch error:", error); }
  };

  const fetchPendingCount = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/pending`);
      const data = await response.json();
      setPendingCount(Array.isArray(data) ? data.length : 0);
    } catch (error) { console.error("Pending fetch error:", error); }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchGuestData();
    fetchPendingCount();
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchGuestData();
      fetchPendingCount();
    }, 5000); // Poll every 5s for real-time updates
    return () => clearInterval(interval);
  }, []);

  // KPI LOGIC - combines students + guests so "visitors" reflects everyone
  // who actually walked into the library, not just registered students.
  const todayStr = new Date().toDateString();
  const logsToday = logs.filter(l => l.visit_date && new Date(l.visit_date).toDateString() === todayStr);
  const guestLogsToday = guestLogs.filter(g => g.visit_date && new Date(g.visit_date).toDateString() === todayStr);
  const totalVisitorsToday = logsToday.length + guestLogsToday.length;

  const currentlyInside = logs.filter(l => l.status === 'inside').length
    + guestLogs.filter(g => g.status === 'inside').length;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  const logsYesterday = logs.filter(l => l.visit_date && new Date(l.visit_date).toDateString() === yesterdayStr);
  const guestLogsYesterday = guestLogs.filter(g => g.visit_date && new Date(g.visit_date).toDateString() === yesterdayStr);
  const totalVisitorsYesterday = logsYesterday.length + guestLogsYesterday.length;

  const visitorsTrend = totalVisitorsYesterday > 0
    ? Math.round(((totalVisitorsToday - totalVisitorsYesterday) / totalVisitorsYesterday) * 100)
    : null;

  const exitedLogs = logs.filter(l => l.time_in && l.time_out);
  const exitedGuestLogs = guestLogs.filter(g => g.time_in && g.time_out);
  const allExited = [...exitedLogs, ...exitedGuestLogs];
  const totalStayMs = allExited.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStay = allExited.length > 0 ? (totalStayMs / allExited.length / (1000 * 60 * 60)).toFixed(1) : "0.0";

  const exitedYesterday = [...logsYesterday, ...guestLogsYesterday].filter(l => l.time_in && l.time_out);
  const avgStayYesterdayMs = exitedYesterday.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStayYesterday = exitedYesterday.length > 0 ? (avgStayYesterdayMs / exitedYesterday.length / (1000 * 60 * 60)) : null;

  // WEEKLY CHART - combines students + guests, only counts entries that
  // actually fall within the current Sun-Sat week
  const getWeeklyData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const { start, end } = getWeekRange(new Date());
    const counts = new Array(7).fill(0);

    const tally = (entries) => {
      entries.forEach(entry => {
        if (!entry.visit_date) return;
        const d = new Date(entry.visit_date);
        if (isNaN(d) || d < start || d > end) return;
        counts[d.getDay()] += 1;
      });
    };
    tally(logs);
    tally(guestLogs);

    return days.map((day, i) => ({ name: day, count: counts[i] }));
  };

  const getCollegeData = () => {
    const counts = logs.reduce((acc, log) => {
      const code = toAcronym(log.college);
      if (code) acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
    return COLLEGES.map(c => ({ name: c, value: counts[c] || 0 })).filter(c => c.value > 0);
  };

  const collegeData = getCollegeData();
  const totalCollegeVisitors = collegeData.reduce((sum, c) => sum + c.value, 0);

  // Merge students + guests into one recent-activity feed, most recent first
  const recentActivity = [
    ...logs.map(l => ({
      name: l.full_name || "Unknown",
      detail: l.program || "Student",
      status: l.status,
      time_in: l.time_in,
      isGuest: false,
    })),
    ...guestLogs.map(g => ({
      name: g.full_name || "Unknown",
      detail: g.guest_type ? `Guest - ${g.guest_type.charAt(0).toUpperCase() + g.guest_type.slice(1)}` : "Guest",
      status: g.status,
      time_in: g.time_in,
      isGuest: true,
    })),
  ]
    .filter(item => item.time_in)
    .sort((a, b) => new Date(b.time_in) - new Date(a.time_in))
    .slice(0, 5);

  // Formats a log's timestamp as "Today, 4:05 PM", "Yesterday, 4:05 PM",
  // or "Jul 10, 4:05 PM" for anything older — avoids ambiguous bare times
  // once entries can span multiple days.
  const formatActivityTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    if (isNaN(d)) return '--:--';

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  };

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px]">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-[20px]">
            <Card
              title="Total visitors today"
              value={totalVisitorsToday}
              subtitle={visitorsTrend === null ? "No data from yesterday" : `${visitorsTrend >= 0 ? '↑' : '↓'} ${Math.abs(visitorsTrend)}% vs yesterday`}
              color="text-green-700"
              border="border-green-700"
            />
            <Card
              title="Currently Inside"
              value={currentlyInside}
              subtitle="Live status"
              color="text-blue-700"
              border="border-blue-700"
            />
            <Card
              title="Pending Registrations"
              value={pendingCount}
              subtitle={pendingCount > 0 ? "Needs review" : "All caught up"}
              color="text-orange-600"
              border="border-orange-600"
            />
            <Card
              title="Avg. Stay Duration"
              value={`${avgStay} hr`}
              subtitle={avgStayYesterday === null ? "Based on exits" : `${parseFloat(avgStay) >= avgStayYesterday ? '↑' : '↓'} vs ${avgStayYesterday.toFixed(1)} hr yesterday`}
              color="text-emerald-700"
              border="border-emerald-700"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-[20px] mt-[20px]">
            <div className="bg-white rounded-[10px] p-[20px] h-[300px]">
              <p className="text-sm text-gray-500 mb-4">Daily entries this week</p>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={getWeeklyData()} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" fontSize={12} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="count" fill="#1B651B" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fill: '#333', fontSize: '12px', fontWeight: 'bold' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-[10px] p-[20px] h-[300px]">
              <p className="text-sm text-gray-500 mb-4">Visitors by College <span className="text-gray-400 font-normal">(students only)</span></p>
              {totalCollegeVisitors === 0 ? (
                <div className="h-[80%] flex items-center justify-center text-sm text-gray-400">
                  No college data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={collegeData}
                      innerRadius={50}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {collegeData.map((entry, i) => <Cell key={i} fill={COLORS[COLLEGES.indexOf(entry.name) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" align="right" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="mt-[20px] bg-white rounded-[10px] p-[20px] w-full shadow-sm">
            <p className="text-[#333] font-semibold mb-[20px]">Recent Activity</p>
            <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-gray-400 uppercase mb-3 px-2">
              <span>Name</span>
              <span>Program</span>
              <span>Status</span>
              <span>Time</span>
            </div>
            {recentActivity.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                No activity recorded yet.
              </div>
            ) : (
              recentActivity.map((item, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
                  <p className="text-gray-800 font-medium flex items-center gap-2">
                    {item.name}
                    {item.isGuest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">GUEST</span>
                    )}
                  </p>
                  <p className="text-gray-600 text-sm">{item.detail}</p>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${item.status === 'inside' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.status === 'inside' ? 'INSIDE' : 'EXITED'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs">
                    {formatActivityTime(item.time_in)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;