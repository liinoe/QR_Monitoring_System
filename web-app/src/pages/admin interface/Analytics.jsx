import React, { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from "recharts";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import FilterSelect from "../../components/FilterSelect";
import FilterTabs from "../../components/FilterTabs";
import KpiTooltipCard from "../../components/KPIToolTipCard";
import StatBarList from "../../components/StatBarList";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const COLLEGE_OPTIONS = ["CAFENR", "CAS", "CCJ", "CED", "CEIT", "CEMDS", "CON", "CSPEAR", "CTHM", "CVMBS", "COM", "CAPS"];
const COLLEGE_COLORS = {
  CAFENR: '#16a34a', CAS: '#ca8a04', CCJ: '#9333ea', CED: '#2563eb', CEIT: '#ea580c',
  CEMDS: '#e11d48', CON: '#dc2626', CSPEAR: '#7f1d1d', CTHM: '#f97316', CVMBS: '#db2777', COM: '#0891b2', CAPS: '#65a30d',
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

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
};
const monthRange = (key) => {
  const [y, m] = key.split('-').map(Number);
  return { start: new Date(y, m - 1, 1, 0, 0, 0), end: new Date(y, m, 0, 23, 59, 59) };
};

const yearRange = (yearStr) => {
  const y = Number(yearStr);
  return { start: new Date(y, 0, 1, 0, 0, 0), end: new Date(y, 11, 31, 23, 59, 59) };
};

// Academic semesters: 1st Sem = Aug-Dec, 2nd Sem = Jan-May, Midyear = Jun-Jul.
// Semester key format: "<AY start year>-<1st|2nd|Summer>", e.g. "2025-1st"
// means the 1st Semester of AY 2025-2026.
const semesterInfo = (date) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (month >= 8) return { ayStart: year, sem: '1st' };
  if (month <= 5) return { ayStart: year - 1, sem: '2nd' };
  return { ayStart: year - 1, sem: 'Summer' }; // Jun-Jul
};
const semesterKey = (date) => {
  const { ayStart, sem } = semesterInfo(date);
  return `${ayStart}-${sem}`;
};
const SEM_NAMES = { '1st': '1st Semester', '2nd': '2nd Semester', 'Summer': 'Midyear' };
const semesterLabel = (key) => {
  const [ayStart, sem] = key.split('-');
  const start = Number(ayStart);
  return `AY ${start}-${start + 1} • ${SEM_NAMES[sem] || sem}`;
};
const semesterRange = (key) => {
  const [ayStartStr, sem] = key.split('-');
  const ayStart = Number(ayStartStr);
  if (sem === '1st') return { start: new Date(ayStart, 7, 1, 0, 0, 0), end: new Date(ayStart, 11, 31, 23, 59, 59) };
  if (sem === '2nd') return { start: new Date(ayStart + 1, 0, 1, 0, 0, 0), end: new Date(ayStart + 1, 4, 31, 23, 59, 59) };
  return { start: new Date(ayStart + 1, 5, 1, 0, 0, 0), end: new Date(ayStart + 1, 6, 31, 23, 59, 59) };
};
const previousSemesterKey = (key) => {
  const [ayStartStr, sem] = key.split('-');
  const ayStart = Number(ayStartStr);
  if (sem === '1st') return `${ayStart - 1}-Summer`;
  if (sem === '2nd') return `${ayStart}-1st`;
  return `${ayStart}-2nd`;
};

const PERIOD_TYPES = ["Month", "Semester", "Year"];

const getPeriodKeyForDate = (periodType, date) => {
  if (periodType === "Month") return monthKey(date);
  if (periodType === "Year") return String(date.getFullYear());
  return semesterKey(date);
};
const getPeriodRange = (periodType, value) => {
  if (periodType === "Month") return monthRange(value);
  if (periodType === "Year") return yearRange(value);
  return semesterRange(value);
};
const getPeriodLabel = (periodType, value) => {
  if (periodType === "Month") return monthLabel(value);
  if (periodType === "Year") return `Year ${value}`;
  return semesterLabel(value);
};
const getPreviousPeriodValue = (periodType, value) => {
  if (periodType === "Month") {
    const [y, m] = value.split('-').map(Number);
    return monthKey(new Date(y, m - 2, 1));
  }
  if (periodType === "Year") return String(Number(value) - 1);
  return previousSemesterKey(value);
};

// A handful of distinct colors for series whose category list is dynamic
// (like programs, which vary school to school), cycled by index.
const PALETTE = ['#16a34a', '#2563eb', '#ea580c', '#9333ea', '#db2777', '#0891b2', '#ca8a04', '#65a30d', '#e11d48', '#7c3aed'];

const GENDER_LABELS = { male: 'Male', female: 'Female', prefer_not_to_say: 'Other' };
const GENDER_COLORS = { male: '#2563eb', female: '#db2777', prefer_not_to_say: '#6b7280' };

const GUEST_TYPE_LABELS = { faculty: 'Faculty', alumni: 'Alumni', walkin: 'Walk-in', student: 'Student' };
const GUEST_TYPE_COLORS = { faculty: '#2563eb', alumni: '#ca8a04', walkin: '#16a34a', student: '#9333ea' };

const KPI_TOOLTIPS = {
  totalVisits: "Counts every entry log — students and guests — with a visit date inside the selected period.",
  avgDaily: "Total visits in this period ÷ number of days elapsed so far (or the full period length, once it has ended).",
  peakHour: "The 2-hour window with the most entries, based on time-in, across the selected period. The subtitle shows the weekday(s) with the most total visits.",
  avgStay: "Average of (time out − time in) across completed visits this period. Visits ended by \"Force Exit All\" or the 5:01 PM auto-logout are excluded, since those don't reflect an actual exit time.",
};

const Analytics = () => {
  const [logs, setLogs] = useState([]);
  const [guestLogs, setGuestLogs] = useState([]);
  const [periodType, setPeriodType] = useState("Month");
  const [selectedPeriod, setSelectedPeriod] = useState(monthKey(new Date()));

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

  // Which period values (of the currently selected type) actually have data,
  // plus the current one so it's always selectable even before any visits.
  const availablePeriods = useMemo(() => {
    const set = new Set([getPeriodKeyForDate(periodType, new Date())]);
    [...logs, ...guestLogs].forEach(l => {
      if (!l.visit_date) return;
      const d = new Date(l.visit_date);
      if (isNaN(d)) return;
      set.add(getPeriodKeyForDate(periodType, d));
    });
    return Array.from(set).sort().reverse();
  }, [logs, guestLogs, periodType]);

  // Snap to the most recent available period whenever the period TYPE changes
  // (e.g. switching from Month to Semester shouldn't keep a month-shaped value).
  useEffect(() => {
    setSelectedPeriod(prev => (availablePeriods.includes(prev) ? prev : availablePeriods[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, availablePeriods]);

  const periodRange = useMemo(() => getPeriodRange(periodType, selectedPeriod), [periodType, selectedPeriod]);

  const periodLogs = useMemo(() => {
    return logs.filter(l => {
      if (!l.visit_date) return false;
      const d = new Date(l.visit_date);
      return !isNaN(d) && d >= periodRange.start && d <= periodRange.end;
    });
  }, [logs, periodRange]);

  const periodGuestLogs = useMemo(() => {
    return guestLogs.filter(g => {
      if (!g.visit_date) return false;
      const d = new Date(g.visit_date);
      return !isNaN(d) && d >= periodRange.start && d <= periodRange.end;
    });
  }, [guestLogs, periodRange]);

  // Combined students + guests, used for overall totals/trends/heatmap
  const combinedPeriodEntries = useMemo(() => [...periodLogs, ...periodGuestLogs], [periodLogs, periodGuestLogs]);

  // KPI: Total visits & avg daily visits (students + guests)
  const totalVisits = combinedPeriodEntries.length;
  const today = new Date();
  const rangeTotalDays = Math.round((periodRange.end - periodRange.start) / (1000 * 60 * 60 * 24)) + 1;
  const isPeriodOngoing = today >= periodRange.start && today <= periodRange.end;
  const daysElapsed = isPeriodOngoing
    ? Math.floor((today - periodRange.start) / (1000 * 60 * 60 * 24)) + 1
    : rangeTotalDays;
  const avgDailyVisits = daysElapsed > 0 ? (totalVisits / daysElapsed).toFixed(1) : "0.0";

  // vs previous period trend
  const previousPeriodValue = getPreviousPeriodValue(periodType, selectedPeriod);
  const previousPeriodRange = useMemo(() => getPeriodRange(periodType, previousPeriodValue), [periodType, previousPeriodValue]);
  const combinedPreviousPeriodEntries = useMemo(() => {
    const inRange = (l) => {
      if (!l.visit_date) return false;
      const d = new Date(l.visit_date);
      return !isNaN(d) && d >= previousPeriodRange.start && d <= previousPeriodRange.end;
    };
    return [...logs.filter(inRange), ...guestLogs.filter(inRange)];
  }, [logs, guestLogs, previousPeriodRange]);
  const visitsTrend = combinedPreviousPeriodEntries.length > 0
    ? Math.round(((totalVisits - combinedPreviousPeriodEntries.length) / combinedPreviousPeriodEntries.length) * 100)
    : null;

  const previousPeriodLabel = getPeriodLabel(periodType, previousPeriodValue).split(' • ')[0];

  // KPI: Peak hour (best 2-hour window) & busiest weekdays (students + guests)
  const { peakLabel, busiestDaysLabel } = useMemo(() => {
    const hourCounts = new Array(24).fill(0);
    const weekdayCounts = new Array(7).fill(0);

    combinedPeriodEntries.forEach(l => {
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

    return { peakLabel: peak, busiestDaysLabel: busiest };
  }, [combinedPeriodEntries]);

  // KPI: Avg stay duration (students + guests). Forced exits (Force Exit All
  // button, or the 5:01 PM auto-logout) don't reflect an actual departure
  // time, so they're excluded from this average.
  const exitedPeriodLogs = combinedPeriodEntries.filter(l => l.time_in && l.time_out && !l.forced_exit);
  const totalStayMs = exitedPeriodLogs.reduce((acc, l) => acc + (new Date(l.time_out) - new Date(l.time_in)), 0);
  const avgStay = exitedPeriodLogs.length > 0 ? (totalStayMs / exitedPeriodLogs.length / (1000 * 60 * 60)).toFixed(1) : "0.0";

  const exitedPreviousPeriod = combinedPreviousPeriodEntries.filter(l => l.time_in && l.time_out && !l.forced_exit);
  const previousPeriodStayMs = exitedPreviousPeriod.reduce((acc, l) => acc + (new Date(l.time_out) - new Date(l.time_in)), 0);
  const avgStayPreviousPeriod = exitedPreviousPeriod.length > 0 ? (previousPeriodStayMs / exitedPreviousPeriod.length / (1000 * 60 * 60)) : null;

  // Entry trend — grouped by week when viewing a single month (W1..W5), or
  // by month when viewing a semester/year (too many weeks to show cleanly).
  const trendData = useMemo(() => {
    if (periodType === "Month") {
      const weekCounts = {};
      combinedPeriodEntries.forEach(l => {
        const d = new Date(l.visit_date);
        if (isNaN(d)) return;
        const weekNum = Math.ceil(d.getDate() / 7);
        weekCounts[weekNum] = (weekCounts[weekNum] || 0) + 1;
      });
      const totalWeeks = Math.ceil(rangeTotalDays / 7);
      return Array.from({ length: totalWeeks }, (_, i) => ({
        name: `W${i + 1}`,
        visits: weekCounts[i + 1] || 0,
      }));
    }

    // Semester/Year: one bucket per calendar month spanned by the range
    const buckets = [];
    const cursor = new Date(periodRange.start.getFullYear(), periodRange.start.getMonth(), 1);
    while (cursor <= periodRange.end) {
      buckets.push({ key: monthKey(cursor), name: MONTH_SHORT[cursor.getMonth()], visits: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));
    combinedPeriodEntries.forEach(l => {
      const d = new Date(l.visit_date);
      if (isNaN(d)) return;
      const key = monthKey(d);
      if (byKey[key]) byKey[key].visits += 1;
    });
    return buckets.map(({ name, visits }) => ({ name, visits }));
  }, [combinedPeriodEntries, periodType, periodRange, rangeTotalDays]);

  const trendTitle = periodType === "Month" ? `Weekly entry trend` : `Monthly entry trend`;

  // Peak hours heatmap matrix (weekday x hour, students + guests)
  const heatmapMatrix = useMemo(() => {
    const matrix = WEEKDAY_LABELS.map(() => HOURS.map(() => 0));
    combinedPeriodEntries.forEach(l => {
      if (!l.time_in) return;
      const d = new Date(l.time_in);
      if (isNaN(d)) return;
      const dayIdx = toMonFirstIndex(d.getDay());
      const hourIdx = HOURS.indexOf(d.getHours());
      if (hourIdx !== -1) matrix[dayIdx][hourIdx] += 1;
    });
    return matrix;
  }, [combinedPeriodEntries]);

  const heatmapMax = Math.max(1, ...heatmapMatrix.flat());

  // Visits by college
  const collegeChartData = useMemo(() => {
    const counts = periodLogs.reduce((acc, l) => {
      const code = toAcronym(l.college);
      if (code) acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
    return COLLEGE_OPTIONS
      .map(c => ({ name: c, visits: counts[c] || 0 }))
      .filter(c => c.visits > 0)
      .sort((a, b) => b.visits - a.visits);
  }, [periodLogs]);

  // Highest program (course) by visits — capped to top 8 so the chart stays
  // readable even at schools with many programs.
  const programChartData = useMemo(() => {
    const counts = {};
    periodLogs.forEach(l => {
      const name = l.program || "Unspecified";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, visits]) => ({ key: name, name, value: visits }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [periodLogs]);

  // Gender comparison (by visit record, same methodology as college/program)
  const genderChartData = useMemo(() => {
    const counts = {};
    periodLogs.forEach(l => {
      const key = l.sex || "prefer_not_to_say";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({ key, name: GENDER_LABELS[key] || key, value: count }));
  }, [periodLogs]);

  // Guest type comparison
  const guestTypeChartData = useMemo(() => {
    const counts = {};
    periodGuestLogs.forEach(g => {
      const key = g.guest_type || "other";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({ key, name: GUEST_TYPE_LABELS[key] || key, value: count }));
  }, [periodGuestLogs]);

  // New vs Returning students — a student is "New" if this period contains
  // the only visit they've ever made; otherwise they're "Returning".
  const { newReturningData, newCount, returningCount } = useMemo(() => {
    const allTimeCountByStudent = {};
    logs.forEach(l => {
      if (!l.student_number) return;
      allTimeCountByStudent[l.student_number] = (allTimeCountByStudent[l.student_number] || 0) + 1;
    });

    const studentsInPeriod = new Set(periodLogs.map(l => l.student_number).filter(Boolean));
    let newC = 0, returningC = 0;
    studentsInPeriod.forEach(sn => {
      if ((allTimeCountByStudent[sn] || 0) <= 1) newC += 1;
      else returningC += 1;
    });

    return {
      newReturningData: [
        { key: 'new', name: 'New', value: newC },
        { key: 'returning', name: 'Returning', value: returningC },
      ].filter(d => d.value > 0),
      newCount: newC,
      returningCount: returningC,
    };
  }, [logs, periodLogs]);

  const totalUniqueStudents = newCount + returningCount;
  const returningPct = totalUniqueStudents > 0 ? Math.round((returningCount / totalUniqueStudents) * 100) : 0;

  // Top visiting students
  const topStudents = useMemo(() => {
    const byStudent = {};
    periodLogs.forEach(l => {
      const key = l.student_number || l.full_name;
      if (!key) return;
      if (!byStudent[key]) {
        byStudent[key] = {
          studentNumber: l.student_number || "N/A",
          college: toAcronym(l.college) || "N/A",
          visits: 0,
          stayMs: 0,
          stayCount: 0,
        };
      }
      byStudent[key].visits += 1;
      if (l.time_in && l.time_out && !l.forced_exit) {
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
  }, [periodLogs]);

  const topProgramName = programChartData[0]?.name;
  const topGenderEntry = [...genderChartData].sort((a, b) => b.value - a.value)[0];
  const topGuestTypeEntry = [...guestTypeChartData].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] pb-[40px] space-y-[20px]">

          <div className="flex justify-between items-center flex-wrap gap-3">
            <p className="text-[#666]">Library usage trends, peak hours, and demographic breakdown.</p>
            <div className="flex items-center gap-3">
              <FilterTabs options={PERIOD_TYPES} value={periodType} onChange={setPeriodType} />
              <FilterSelect value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{getPeriodLabel(periodType, p)}</option>
                ))}
              </FilterSelect>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-[20px]">
            <KpiTooltipCard
              tooltip={KPI_TOOLTIPS.totalVisits}
              title={`Total visits (${periodType.toLowerCase()})`}
              value={totalVisits}
              subtitle={visitsTrend === null ? `No data last ${periodType.toLowerCase()}` : `${visitsTrend >= 0 ? '↑' : '↓'} ${Math.abs(visitsTrend)}% vs ${previousPeriodLabel}`}
              color="text-green-700"
              border="border-green-700"
            />
            <KpiTooltipCard
              tooltip={KPI_TOOLTIPS.avgDaily}
              title="Avg. daily visits"
              value={avgDailyVisits}
              subtitle="Weekdays and weekends"
              color="text-blue-700"
              border="border-blue-700"
            />
            <KpiTooltipCard
              tooltip={KPI_TOOLTIPS.peakHour}
              title="Peak hour"
              value={peakLabel}
              subtitle={busiestDaysLabel}
              color="text-orange-600"
              border="border-orange-600"
            />
            <KpiTooltipCard
              tooltip={KPI_TOOLTIPS.avgStay}
              title="Avg. stay duration"
              value={`${avgStay} hr`}
              subtitle={avgStayPreviousPeriod === null ? "Based on exits" : `${parseFloat(avgStay) >= avgStayPreviousPeriod ? '↑' : '↓'} vs ${avgStayPreviousPeriod.toFixed(1)} hr ${previousPeriodLabel}`}
              color="text-emerald-700"
              border="border-emerald-700"
            />
          </div>

          {/* Weekly/Monthly trend + Peak hours heatmap */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div className="bg-white rounded-[10px] p-[20px] h-[320px]">
              <p className="text-sm font-semibold text-green-700 mb-4">{trendTitle} - {getPeriodLabel(periodType, selectedPeriod)} <span className="text-gray-400 font-normal">(students + guests)</span></p>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
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
              <p className="text-sm font-semibold text-green-700 mb-4">Visits by College <span className="text-gray-400 font-normal">— students only</span></p>
              {collegeChartData.length === 0 ? (
                <div className="h-[90%] flex items-center justify-center text-sm text-gray-400">
                  No visits recorded this {periodType.toLowerCase()}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={collegeChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" fontSize={12} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" fontSize={12} width={60} interval={0} />
                    <Tooltip cursor={false} />
                    <Bar dataKey="visits" radius={[0, 4, 4, 0]} barSize={22}>
                      {collegeChartData.map((entry, i) => (
                        <Cell key={i} fill={COLLEGE_COLORS[entry.name]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-[10px] p-[20px] h-[340px] overflow-auto">
              <p className="text-sm font-semibold text-green-700 mb-4">Top Visiting Students <span className="text-gray-400 font-normal">— students only</span></p>
              {topStudents.length === 0 ? (
                <div className="h-[80%] flex items-center justify-center text-sm text-gray-400">
                  No visits recorded this {periodType.toLowerCase()}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b">
                      <th className="pb-2 font-semibold">#</th>
                      <th className="pb-2 font-semibold">Student No.</th>
                      <th className="pb-2 font-semibold">College</th>
                      <th className="pb-2 font-semibold">Visits</th>
                      <th className="pb-2 font-semibold">Avg Stay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStudents.map((s, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 text-gray-500">{i + 1}</td>
                        <td className="py-2 text-gray-700 font-medium">{s.studentNumber}</td>
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

          {/* Guest type comparison (chart) + New vs Returning (simple list) */}
          <div className="grid grid-cols-2 gap-[20px] items-start">
            <div className="bg-white rounded-[10px] p-[20px] h-[320px]">
              <p className="text-sm font-semibold text-green-700 mb-1">Guest Type Comparison</p>
              <p className="text-xs text-gray-400 mb-2">
                {topGuestTypeEntry ? `${topGuestTypeEntry.name} visits the most this ${periodType.toLowerCase()}` : "No guest visits yet"}
              </p>
              {guestTypeChartData.length === 0 ? (
                <div className="h-[75%] flex items-center justify-center text-sm text-gray-400">
                  No guest visits recorded this {periodType.toLowerCase()}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="82%">
                  <PieChart>
                    <Pie
                      data={guestTypeChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {guestTypeChartData.map((entry) => (
                        <Cell key={entry.key} fill={GUEST_TYPE_COLORS[entry.key] || '#9ca3af'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} visit(s)`, name]} />
                    <Legend verticalAlign="bottom" height={24} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-[10px] p-[20px] min-h-[160px]">
              <p className="text-sm font-semibold text-green-700 mb-1">New vs Returning Students</p>
              <p className="text-xs text-gray-400 mb-3">
                {totalUniqueStudents > 0 ? `${returningPct}% of visiting students this ${periodType.toLowerCase()} are returning` : "No student visits yet"}
              </p>
              <StatBarList
                data={newReturningData}
                colorFor={(item) => (item.key === 'new' ? '#2563eb' : '#16a34a')}
                emptyLabel={`No visits recorded this ${periodType.toLowerCase()}`}
              />
            </div>
          </div>

          {/* Gender comparison + Highest program (simple lists) */}
          <div className="grid grid-cols-2 gap-[20px] items-start">
            <div className="bg-white rounded-[10px] p-[20px] min-h-[160px]">
              <p className="text-sm font-semibold text-green-700 mb-1">Gender Comparison <span className="text-gray-400 font-normal text-xs">— students only</span></p>
              <p className="text-xs text-gray-400 mb-3">
                {topGenderEntry ? `${topGenderEntry.name} makes up the most visits this ${periodType.toLowerCase()}` : "No student visits yet"}
              </p>
              <StatBarList
                data={genderChartData}
                colorFor={(item) => GENDER_COLORS[item.key] || '#9ca3af'}
                emptyLabel={`No visits recorded this ${periodType.toLowerCase()}`}
              />
            </div>

            <div className="bg-white rounded-[10px] p-[20px] min-h-[160px]">
              <p className="text-sm font-semibold text-green-700 mb-1">Highest Program by Visits <span className="text-gray-400 font-normal text-xs">— students only</span></p>
              <p className="text-xs text-gray-400 mb-3">
                {topProgramName ? `${topProgramName} leads this ${periodType.toLowerCase()}` : "No student visits yet"}
              </p>
              <StatBarList
                data={programChartData}
                colorFor={(item, i) => PALETTE[i % PALETTE.length]}
                emptyLabel={`No visits recorded this ${periodType.toLowerCase()}`}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Analytics;