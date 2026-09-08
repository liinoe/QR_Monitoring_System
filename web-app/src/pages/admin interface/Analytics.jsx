import React, { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const COLLEGE_OPTIONS = ["CAFENR", "CAS", "CCJ", "CED", "CEIT", "CEMDS", "CON", "CSPEAR", "CTHM", "CVMBS", "COM", "CAPS"];
const COLLEGE_COLORS = {
  CAFENR: '#16a34a', CAS: '#ca8a04', CCJ: '#9333ea', CED: '#2563eb', CEIT: '#ea580c',
  CEMDS: '#e11d48', CON: '#dc2626', CSPEAR: '#7f1d1d', CTHM: '#f97316', CVMBS: '#db2777', COM: '#', CAPS: '#',
};

const COLLEGE_ACRONYMS = {
  "college of agriculture, food, environment and natural resources": "CAFENR",
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
  if (!college) return null;
  const key = college.trim().toLowerCase();
  return COLLEGE_ACRONYMS[key] || college.trim().toUpperCase();
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Convert JS getDay() (0=Sun) to a Mon-first index (0=Mon .. 6=Sun)
const toMonFirstIndex = (jsDay) => (jsDay + 6) % 7;

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const formatHour = (h) => {
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${period}`;
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
};

const Analytics = () => {
  const [logs, setLogs] = useState([]);
  const [guestLogs, setGuestLogs] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));

  const fetchLogs = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/logs/all`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const fetchGuestLogs = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/guests/all`);
      const data = await response.json();
      setGuestLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Guest fetch error:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchGuestLogs();
    const interval = setInterval(() => {
      fetchLogs();
      fetchGuestLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const availableMonths = useMemo(() => {
    const set = new Set([monthKey(new Date())]);
    logs.forEach(l => {
      if (l.visit_date) {
        const d = new Date(l.visit_date);
        if (!isNaN(d)) set.add(monthKey(d));
      }
    });
    return Array.from(set).sort().reverse();
  }, [logs]);

  const monthLogs = useMemo(() => {
    return logs.filter(l => {
      if (!l.visit_date) return false;
      const d = new Date(l.visit_date);
      return !isNaN(d) && monthKey(d) === selectedMonth;
    });
  }, [logs, selectedMonth]);

  const monthGuestLogs = useMemo(() => {
    return guestLogs.filter(g => {
      if (!g.visit_date) return false;
      const d = new Date(g.visit_date);
      return !isNaN(d) && monthKey(d) === selectedMonth;
    });
  }, [guestLogs, selectedMonth]);

  // Combined students + guests, used for overall totals/trends/heatmap
  const combinedMonthEntries = useMemo(() => [...monthLogs, ...monthGuestLogs], [monthLogs, monthGuestLogs]);

  // KPI: Total visits & avg daily visits (students + guests)
  const totalVisits = combinedMonthEntries.length;
  const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
  const today = new Date();
  const isCurrentMonth = selectedMonth === monthKey(today);
  const daysInMonth = new Date(selYear, selMonthNum, 0).getDate();
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
  const avgDailyVisits = daysElapsed > 0 ? (totalVisits / daysElapsed).toFixed(1) : "0.0";

  // vs last month trend
  const lastMonthDate = new Date(selYear, selMonthNum - 2, 1);
  const lastMonthKey = monthKey(lastMonthDate);
  const lastMonthLogs = logs.filter(l => {
    if (!l.visit_date) return false;
    const d = new Date(l.visit_date);
    return !isNaN(d) && monthKey(d) === lastMonthKey;
  });
  const lastMonthGuestLogs = guestLogs.filter(g => {
    if (!g.visit_date) return false;
    const d = new Date(g.visit_date);
    return !isNaN(d) && monthKey(d) === lastMonthKey;
  });
  const combinedLastMonthEntries = [...lastMonthLogs, ...lastMonthGuestLogs];
  const visitsTrend = combinedLastMonthEntries.length > 0
    ? Math.round(((totalVisits - combinedLastMonthEntries.length) / combinedLastMonthEntries.length) * 100)
    : null;

  // KPI: Peak hour (best 2-hour window) & busiest weekdays (students + guests) ──
  const { peakLabel, busiestDaysLabel } = useMemo(() => {
    const hourCounts = new Array(24).fill(0);
    const weekdayCounts = new Array(7).fill(0);

    combinedMonthEntries.forEach(l => {
      if (!l.time_in) return;
      const d = new Date(l.time_in);
      if (isNaN(d)) return;
      hourCounts[d.getHours()] += 1;
      weekdayCounts[toMonFirstIndex(d.getDay())] += 1;
    });

    let bestWindowStart = 0, bestWindowCount = -1;
    for (let h = 0; h < 23; h++) {
      const windowCount = hourCounts[h] + hourCounts[h + 1];
      if (windowCount > bestWindowCount) {
        bestWindowCount = windowCount;
        bestWindowStart = h;
      }
    }
    const peak = bestWindowCount > 0
      ? `${formatHour(bestWindowStart)}-${formatHour(bestWindowStart + 2)}`
      : "--";

    const maxCount = Math.max(...weekdayCounts);
    const topDays = maxCount > 0
      ? WEEKDAY_LABELS.filter((_, i) => weekdayCounts[i] === maxCount)
      : [];
    const busiest = topDays.length === 0 ? "No data yet"
      : topDays.length === 1 ? `${topDays[0]} busiest`
      : `${topDays.slice(0, 2).join(' & ')} busiest`;

    return { peakLabel: peak, busiestDaysLabel: busiest, hourCounts, weekdayCounts };
  }, [combinedMonthEntries]);

  // KPI: Avg stay duration (students + guests) 
  const exitedMonthLogs = combinedMonthEntries.filter(l => l.time_in && l.time_out);
  const totalStayMs = exitedMonthLogs.reduce((acc, l) => acc + (new Date(l.time_out) - new Date(l.time_in)), 0);
  const avgStay = exitedMonthLogs.length > 0 ? (totalStayMs / exitedMonthLogs.length / (1000 * 60 * 60)).toFixed(1) : "0.0";

  const exitedLastMonth = combinedLastMonthEntries.filter(l => l.time_in && l.time_out);
  const lastMonthStayMs = exitedLastMonth.reduce((acc, l) => acc + (new Date(l.time_out) - new Date(l.time_in)), 0);
  const avgStayLastMonth = exitedLastMonth.length > 0 ? (lastMonthStayMs / exitedLastMonth.length / (1000 * 60 * 60)) : null;

  // Weekly entry trend (W1..W5 of the selected month, students + guests)
  const weeklyTrendData = useMemo(() => {
    const weekCounts = {};
    combinedMonthEntries.forEach(l => {
      const d = new Date(l.visit_date);
      if (isNaN(d)) return;
      const weekNum = Math.ceil(d.getDate() / 7);
      weekCounts[weekNum] = (weekCounts[weekNum] || 0) + 1;
    });
    const totalWeeks = Math.ceil(daysInMonth / 7);
    return Array.from({ length: totalWeeks }, (_, i) => ({
      name: `W${i + 1}`,
      visits: weekCounts[i + 1] || 0,
    }));
  }, [combinedMonthEntries, daysInMonth]);

  // Peak hours heatmap matrix (weekday x hour, students + guests) 
  const heatmapMatrix = useMemo(() => {
    const matrix = WEEKDAY_LABELS.map(() => HOURS.map(() => 0));
    combinedMonthEntries.forEach(l => {
      if (!l.time_in) return;
      const d = new Date(l.time_in);
      if (isNaN(d)) return;
      const dayIdx = toMonFirstIndex(d.getDay());
      const hourIdx = HOURS.indexOf(d.getHours());
      if (hourIdx !== -1) matrix[dayIdx][hourIdx] += 1;
    });
    return matrix;
  }, [combinedMonthEntries]);

  const heatmapMax = Math.max(1, ...heatmapMatrix.flat());

  // Visits by college 
  const collegeChartData = useMemo(() => {
    const counts = monthLogs.reduce((acc, l) => {
      const code = toAcronym(l.college);
      if (code) acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
    return COLLEGE_OPTIONS.map(c => ({ name: c, visits: counts[c] || 0 }));
  }, [monthLogs]);

  // Top visiting students
  const topStudents = useMemo(() => {
    const byStudent = {};
    monthLogs.forEach(l => {
      const key = l.student_number || l.full_name;
      if (!key) return;
      if (!byStudent[key]) {
        byStudent[key] = {
          name: l.full_name || "Unknown",
          college: toAcronym(l.college) || "N/A",
          visits: 0,
          stayMs: 0,
          stayCount: 0,
        };
      }
      byStudent[key].visits += 1;
      if (l.time_in && l.time_out) {
        byStudent[key].stayMs += (new Date(l.time_out) - new Date(l.time_in));
        byStudent[key].stayCount += 1;
      }
    });

    return Object.values(byStudent)
      .map(s => ({
        ...s,
        avgStay: s.stayCount > 0 ? (s.stayMs / s.stayCount / (1000 * 60 * 60)).toFixed(1) : "--",
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);
  }, [monthLogs]);

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] pb-[40px] space-y-[20px]">

          <div className="flex justify-between items-center">
            <p className="text-[#666]">Library usage trends, peak hours, and departmental breakdown.</p>
            <select
              className="border px-4 py-2 rounded-lg bg-white text-gray-600 text-sm"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-[20px]">
            <Card
              title="Total visits (month)"
              value={totalVisits}
              subtitle={visitsTrend === null ? "No data last month" : `${visitsTrend >= 0 ? '↑' : '↓'} ${Math.abs(visitsTrend)}% vs last month`}
              color="text-green-700"
              border="border-green-700"
            />
            <Card
              title="Avg. daily visits"
              value={avgDailyVisits}
              subtitle="Weekdays and weekends"
              color="text-blue-700"
              border="border-blue-700"
            />
            <Card
              title="Peak hour"
              value={peakLabel}
              subtitle={busiestDaysLabel}
              color="text-orange-600"
              border="border-orange-600"
            />
            <Card
              title="Avg. stay duration"
              value={`${avgStay} hr`}
              subtitle={avgStayLastMonth === null ? "Based on exits" : `${parseFloat(avgStay) >= avgStayLastMonth ? '↑' : '↓'} vs ${avgStayLastMonth.toFixed(1)} hr last month`}
              color="text-emerald-700"
              border="border-emerald-700"
            />
          </div>

          {/* Weekly trend + Peak hours heatmap */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div className="bg-white rounded-[10px] p-[20px] h-[320px]">
              <p className="text-sm font-semibold text-green-700 mb-4">Weekly entry trend - {monthLabel(selectedMonth)} <span className="text-gray-400 font-normal">(students + guests)</span></p>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="visits" stroke="#16a34a" fill="#bbf7d0" strokeWidth={2} name="Visitors" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-[10px] p-[20px] h-[320px]">
              <p className="text-sm font-semibold text-green-700 mb-4">Peak Hours (visits/hour) <span className="text-gray-400 font-normal">(students + guests)</span></p>

              <div className="grid gap-1" style={{ gridTemplateColumns: `36px repeat(${HOURS.length}, 1fr)` }}>
                {heatmapMatrix.map((row, dayIdx) => (
                  <React.Fragment key={dayIdx}>
                    <div className="text-[10px] text-gray-400 flex items-center" style={{ height: '22px' }}>{WEEKDAY_LABELS[dayIdx]}</div>
                    {row.map((count, hourIdx) => {
                      const intensity = count === 0 ? 0.06 : 0.15 + (count / heatmapMax) * 0.75;
                      return (
                        <div
                          key={`${dayIdx}-${hourIdx}`}
                          title={`${WEEKDAY_LABELS[dayIdx]} ${formatHour(HOURS[hourIdx])}: ${count} visits`}
                          className="rounded"
                          style={{ height: '22px', backgroundColor: `rgba(22, 101, 52, ${intensity})` }}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}

                {/* Hour axis, aligned under the same 9 columns as the grid */}
                <div />
                {HOURS.map((h, i) => (
                  <div key={h} className="text-[9px] text-gray-400 text-center">
                    {i % 2 === 0 ? formatHour(h) : ''}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-400">
                <span>Low</span>
                <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right, rgba(22,101,52,0.06), rgba(22,101,52,0.9))' }} />
                <span>High</span>
              </div>
            </div>
          </div>

          {/* Visits by college + Top students */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div className="bg-white rounded-[10px] p-[20px] h-[340px]">
              <p className="text-sm font-semibold text-green-700 mb-4">Visits by College (this month) <span className="text-gray-400 font-normal">— students only</span></p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={collegeChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={60} />
                  <Tooltip cursor={false} />
                  <Bar dataKey="visits" radius={[0, 4, 4, 0]}>
                    {collegeChartData.map((entry, i) => (
                      <Cell key={i} fill={COLLEGE_COLORS[entry.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-[10px] p-[20px] h-[340px] overflow-auto">
              <p className="text-sm font-semibold text-green-700 mb-4">Top Visiting Students <span className="text-gray-400 font-normal">— students only</span></p>
              {topStudents.length === 0 ? (
                <div className="h-[80%] flex items-center justify-center text-sm text-gray-400">
                  No visits recorded this month
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b">
                      <th className="pb-2 font-semibold">#</th>
                      <th className="pb-2 font-semibold">Student</th>
                      <th className="pb-2 font-semibold">College</th>
                      <th className="pb-2 font-semibold">Visits</th>
                      <th className="pb-2 font-semibold">Avg Stay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStudents.map((s, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 text-gray-500">{i + 1}</td>
                        <td className="py-2 text-gray-700 font-medium">{s.name}</td>
                        <td className="py-2 text-gray-500">{s.college}</td>
                        <td className="py-2 text-green-700 font-semibold">{s.visits}</td>
                        <td className="py-2 text-gray-500">{s.avgStay === "--" ? "--" : `${s.avgStay} hr`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Analytics;