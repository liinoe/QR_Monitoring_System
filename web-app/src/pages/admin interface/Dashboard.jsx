import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from "recharts";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { buildAvgStayTooltip } from "../../components/AvgStayToolTip";
import { authFetch } from "../../auth";
import {
  BRAND,
  COLLEGE_COLORS,
  Card,
  CardTitle,
  SectionLabel,
  Pill,
  KpiCard,
  TrendPill,
  ChartTooltip,
  Avatar,
  EmptyState,
} from "../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// College codes, A–Z (colors come from COLLEGE_COLORS in AdminUI.jsx).
const COLLEGES = Object.keys(COLLEGE_COLORS);

// Full college names → short codes.
const COLLEGE_ACRONYMS = {
  "college of agriculture, food, environment, and natural resources": "CAFENR",
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
  if (!college) return null;
  const key = college.trim().toLowerCase();
  return COLLEGE_ACRONYMS[key] || college.trim().toUpperCase();
};

// Start (Sunday 12:00 AM) and end (Saturday 11:59 PM) of the week a date is in.
const getWeekRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Shows a log's time as "Today, 4:05 PM", "Yesterday, 4:05 PM" or "Jul 10, 4:05 PM".
const formatActivityTime = (dateStr) => {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  if (isNaN(d)) return "--:--";
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
};

// Explanations shown on the "i" icons of the KPI cards.
const KPI_TOOLTIPS = {
  totalToday: "Counts every entry log — students and guests — with today's date, regardless of whether they've exited yet.",
  currentlyInside: "Live count of every log (students + guests) currently marked as \"inside\" right now.",
  pending: "Number of student registration requests awaiting admin approval on the Registrations page.",
};

// Admin home page: today's numbers, this week's charts and the latest entries.
const Dashboard = () => {
  const [logs, setLogs] = useState([]);
  const [guestLogs, setGuestLogs] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Gets every student entry/exit log.
  const fetchDashboardData = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/logs/all`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  // Gets every guest visit.
  const fetchGuestData = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/guests/all`);
      const data = await response.json();
      setGuestLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Guest fetch error:", error);
    }
  };

  // Gets how many registrations are waiting for approval.
  const fetchPendingCount = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/pending`);
      const data = await response.json();
      setPendingCount(Array.isArray(data) ? data.length : 0);
    } catch (error) {
      console.error("Pending fetch error:", error);
    }
  };

  // Loads everything now, then refreshes every 5 seconds.
  useEffect(() => {
    fetchDashboardData();
    fetchGuestData();
    fetchPendingCount();
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchGuestData();
      fetchPendingCount();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ---- KPIs (students + guests together) ----
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  // Keeps only the entries whose visit_date is on the given day.
  const onDay = (list, dayStr) => list.filter((l) => l.visit_date && new Date(l.visit_date).toDateString() === dayStr);

  const logsToday = onDay(logs, todayStr);
  const guestLogsToday = onDay(guestLogs, todayStr);
  const totalVisitorsToday = logsToday.length + guestLogsToday.length;
  const totalVisitorsYesterday = onDay(logs, yesterdayStr).length + onDay(guestLogs, yesterdayStr).length;

  const visitorsTrend = totalVisitorsYesterday > 0
    ? Math.round(((totalVisitorsToday - totalVisitorsYesterday) / totalVisitorsYesterday) * 100)
    : null;

  const studentsInside = logs.filter((l) => l.status === "inside").length;
  const guestsInside = guestLogs.filter((g) => g.status === "inside").length;
  const currentlyInside = studentsInside + guestsInside;

  // Average stay: forced exits (Force Exit All / 5:31 PM auto-logout) are left out,
  // since they don't show when the person really left — same rule as Analytics.
  const exitedToday = [...logsToday, ...guestLogsToday].filter((l) => l.time_in && l.time_out && !l.forced_exit);
  const totalStayMs = exitedToday.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStay = exitedToday.length > 0 ? (totalStayMs / exitedToday.length / (1000 * 60 * 60)).toFixed(1) : "0.0";
  const forcedExitCount = [...logsToday, ...guestLogsToday].filter((l) => l.time_in && l.time_out && l.forced_exit).length;
  const avgStayTooltip = buildAvgStayTooltip(exitedToday.length, totalStayMs, avgStay, forcedExitCount);

  const exitedYesterday = [...onDay(logs, yesterdayStr), ...onDay(guestLogs, yesterdayStr)].filter(
    (l) => l.time_in && l.time_out && !l.forced_exit
  );
  const avgStayYesterdayMs = exitedYesterday.reduce((acc, log) => acc + (new Date(log.time_out) - new Date(log.time_in)), 0);
  const avgStayYesterday = exitedYesterday.length > 0 ? avgStayYesterdayMs / exitedYesterday.length / (1000 * 60 * 60) : null;

  // ---- Weekly bar chart (students + guests, Sun–Sat of this week) ----
  // Counts entries per day of the current week.
  const getWeeklyData = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const { start, end } = getWeekRange(now);
    const counts = new Array(7).fill(0);
    [...logs, ...guestLogs].forEach((entry) => {
      if (!entry.visit_date) return;
      const d = new Date(entry.visit_date);
      if (isNaN(d) || d < start || d > end) return;
      counts[d.getDay()] += 1;
    });
    return days.map((day, i) => ({ name: day, count: counts[i], isToday: i === now.getDay() }));
  };
  const weeklyData = getWeeklyData();
  const weekTotal = weeklyData.reduce((sum, d) => sum + d.count, 0);

  // ---- College donut (students only, this week) ----
  // Counts this week's student entries per college, biggest first.
  const getCollegeData = () => {
    const { start, end } = getWeekRange(now);
    const counts = {};
    logs.forEach((log) => {
      if (!log.visit_date) return;
      const d = new Date(log.visit_date);
      if (isNaN(d) || d < start || d > end) return;
      const code = toAcronym(log.college);
      if (code) counts[code] = (counts[code] || 0) + 1;
    });
    return COLLEGES.map((c) => ({ name: c, value: counts[c] || 0 }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
  };
  const collegeData = getCollegeData();
  const totalCollegeVisitors = collegeData.reduce((sum, c) => sum + c.value, 0);

  // ---- Recent activity: latest 5 student + guest entries ----
  const recentActivity = [
    ...logs.map((l) => ({
      name: l.student_number || "Unknown", // students: student number in bold
      sub: l.program || "Student",         // program in gray underneath
      status: l.status,
      time_in: l.time_in,
      isGuest: false,
    })),
    ...guestLogs.map((g) => ({
      name: g.full_name || "Unknown",
      sub: g.guest_type ? `Guest · ${g.guest_type.charAt(0).toUpperCase() + g.guest_type.slice(1)}` : "Guest",
      status: g.status,
      time_in: g.time_in,
      isGuest: true,
    })),
  ]
    .filter((item) => item.time_in)
    .sort((a, b) => new Date(b.time_in) - new Date(a.time_in))
    .slice(0, 5);

  const dateText = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          {/* PAGE TITLE */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-bold text-gray-900 leading-tight">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Here's what's happening at the library today.</p>
            </div>
            <Pill tone="gray">{dateText}</Pill>
          </div>

          {/* KPI CARDS */}
          <div>
            <SectionLabel>Today</SectionLabel>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
              <KpiCard
                label="Total Visitors Today"
                value={totalVisitorsToday}
                color={BRAND.green}
                tooltip={KPI_TOOLTIPS.totalToday}
                footer={
                  <TrendPill
                    change={visitorsTrend}
                    suffix={`${Math.abs(visitorsTrend ?? 0)}% vs yesterday`}
                    emptyText="No data from yesterday"
                  />
                }
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
                      {studentsInside} students · {guestsInside} guests
                    </span>
                  </div>
                }
              />
              <KpiCard
                label="Pending Registrations"
                value={pendingCount}
                color={pendingCount > 0 ? BRAND.goldText : "#9CA3AF"}
                tooltip={KPI_TOOLTIPS.pending}
                footer={pendingCount > 0 ? <Pill tone="gold">Needs review</Pill> : <Pill tone="green">All caught up</Pill>}
              />
              <KpiCard
                label="Avg. Stay Duration"
                value={avgStay}
                unit="hr"
                color={BRAND.deep}
                tooltip={avgStayTooltip}
                footer={
                  <TrendPill
                    change={avgStayYesterday === null ? null : parseFloat(avgStay) - avgStayYesterday}
                    suffix={`vs ${avgStayYesterday?.toFixed(1)} hr yesterday`}
                    emptyText="Based on today's exits"
                  />
                }
              />
            </div>
          </div>

          {/* CHARTS */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* Daily entries this week */}
            <Card className="p-6 xl:col-span-3">
              <CardTitle
                title="Daily Entries"
                note="Students and guests, this week (Sun – Sat)"
                right={<Pill tone="green">{weekTotal} this week</Pill>}
              />
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: "#6B7280" }} />
                    <Tooltip cursor={{ fill: "rgba(27,94,32,0.05)" }} content={<ChartTooltip unit="entries" />} />
                    <Bar dataKey="count" radius={[8, 8, 8, 8]} maxBarSize={48}>
                      {/* Today's bar is gold, the rest are green */}
                      {weeklyData.map((d) => (
                        <Cell key={d.name} fill={d.isToday ? BRAND.gold : BRAND.green} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fill: "#374151", fontSize: 12, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Visitors by college */}
            <Card className="p-6 xl:col-span-2">
              <CardTitle title="Visitors by College" note="Students only, this week" />
              {totalCollegeVisitors === 0 ? (
                <EmptyState text="No college data this week" />
              ) : (
                <div className="flex items-center gap-5 h-[240px]">
                  {/* Donut with the total in the middle */}
                  <div className="relative w-[180px] h-[180px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={collegeData} innerRadius={58} outerRadius={84} paddingAngle={2} dataKey="value" stroke="none">
                          {collegeData.map((entry) => (
                            <Cell key={entry.name} fill={COLLEGE_COLORS[entry.name] || "#9CA3AF"} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip unit="visitors" />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-[26px] font-extrabold text-gray-900 leading-none">{totalCollegeVisitors}</p>
                      <p className="text-[11px] text-gray-500 mt-1">visitors</p>
                    </div>
                  </div>

                  {/* Legend: college · count · share */}
                  <ul className="flex-1 min-w-0 space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {collegeData.map((c) => (
                      <li key={c.name} className="flex items-center gap-2 text-[13px]">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLLEGE_COLORS[c.name] }} />
                        <span className="font-semibold text-gray-700 flex-1">{c.name}</span>
                        <span className="font-bold text-gray-900 tabular-nums">{c.value}</span>
                        <span className="text-gray-400 text-xs w-10 text-right tabular-nums">
                          {Math.round((c.value / totalCollegeVisitors) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          {/* RECENT ACTIVITY */}
          <Card className="p-6">
            <CardTitle title="Recent Activity" note="Latest 5 entries — students and guests" />
            {recentActivity.length === 0 ? (
              <EmptyState text="No activity recorded yet." />
            ) : (
              <ul className="divide-y divide-[#F1F3F1]">
                {recentActivity.map((item, i) => (
                  <li key={i} className="flex items-center gap-4 py-3">
                    <Avatar name={item.name} guest={item.isGuest} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 truncate flex items-center gap-2">
                        {item.name}
                        {item.isGuest && <Pill tone="gold">GUEST</Pill>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{item.sub}</p>
                    </div>
                    <Pill tone={item.status === "inside" ? "green" : "gray"}>
                      {item.status === "inside" ? "INSIDE" : "EXITED"}
                    </Pill>
                    <p className="text-xs text-gray-400 w-[130px] text-right tabular-nums">{formatActivityTime(item.time_in)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;