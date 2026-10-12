import React, { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import FilterSelect from "../../components/FilterSelect";
import FilterTabs from "../../components/FilterTabs";
import { buildAvgStayTooltip } from "../../components/AvgStayToolTip";
import StatBarList from "../../components/StatBarList";
import HoverTooltip from "../../components/HoverTooltip";
import { authFetch } from "../../auth";
import { BRAND, PageTitle, Card, CardTitle, SectionLabel, KpiCard, TrendPill, ChartTooltip, EmptyState } from "../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const COLLEGE_OPTIONS = ["CAFENR", "CAS", "CCJ", "CED", "CEIT", "CEMDS", "CON", "CSPEAR", "CTHM", "CVMBS", "COM", "CAPS"];

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

// Turns a full college name into its acronym, e.g. "College of Arts and Sciences" → "CAS".
const toAcronym = (college) => {
  if (!college) return null;
  const key = college.trim().toLowerCase();
  return COLLEGE_ACRONYMS[key] || college.trim().toUpperCase();
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Convert JS getDay() (0=Sun) to a Mon-first index (0=Mon .. 6=Sun)
const toMonFirstIndex = (jsDay) => (jsDay + 6) % 7;

// Heatmap columns = library hours: opens 7 AM, closes 6 PM (cut-off 5:30 PM).
// 7 = 7–8 AM ... 17 = 5–6 PM. Same hours as the mobile app's Peak Hours chart.
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
// Formats an hour number as a label, e.g. 13 → "1PM".
const formatHour = (h) => {
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${period}`;
};

const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Hover bubble for one heatmap square, e.g. "Tuesday · 11AM – 12PM" + "5 visits".
const HeatCellTip = ({ dayIdx, hour, count }) => (
  <span className="block text-left">
    <span className="block font-semibold">{WEEKDAY_FULL[dayIdx]} · {formatHour(hour)} – {formatHour(hour + 1)}</span>
    <span className="block text-white/75 mt-0.5">{count === 0 ? "No visits" : `${count} ${count === 1 ? "visit" : "visits"}`}</span>
  </span>
);

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Month id for a date, e.g. "2026-09".
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
// "2026-09" → "September 2026".
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
};
// First and last moment of a month.
const monthRange = (key) => {
  const [y, m] = key.split('-').map(Number);
  return { start: new Date(y, m - 1, 1, 0, 0, 0), end: new Date(y, m, 0, 23, 59, 59) };
};

// First and last moment of a year.
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
// Semester id for a date, e.g. "2026-1st".
const semesterKey = (date) => {
  const { ayStart, sem } = semesterInfo(date);
  return `${ayStart}-${sem}`;
};
const SEM_NAMES = { '1st': '1st Semester', '2nd': '2nd Semester', 'Summer': 'Midyear' };
// "2026-1st" → "AY 2026-2027 • 1st Semester".
const semesterLabel = (key) => {
  const [ayStart, sem] = key.split('-');
  const start = Number(ayStart);
  return `AY ${start}-${start + 1} • ${SEM_NAMES[sem] || sem}`;
};
// Start and end dates of a semester (1st = Aug–Dec, 2nd = Jan–May, Midyear = Jun–Jul).
const semesterRange = (key) => {
  const [ayStartStr, sem] = key.split('-');
  const ayStart = Number(ayStartStr);
  if (sem === '1st') return { start: new Date(ayStart, 7, 1, 0, 0, 0), end: new Date(ayStart, 11, 31, 23, 59, 59) };
  if (sem === '2nd') return { start: new Date(ayStart + 1, 0, 1, 0, 0, 0), end: new Date(ayStart + 1, 4, 31, 23, 59, 59) };
  return { start: new Date(ayStart + 1, 5, 1, 0, 0, 0), end: new Date(ayStart + 1, 6, 31, 23, 59, 59) };
};
// The semester before this one (used for the "vs last period" comparisons).
const previousSemesterKey = (key) => {
  const [ayStartStr, sem] = key.split('-');
  const ayStart = Number(ayStartStr);
  if (sem === '1st') return `${ayStart - 1}-Summer`;
  if (sem === '2nd') return `${ayStart}-1st`;
  return `${ayStart}-2nd`;
};

// ---- Academic calendar (Settings) ----
// Once the Super Admin has added semesters, the "Semester" filter uses their REAL
// dates (same as the mobile app). Keys look like "cal-12" (semester_id 12).
// If no semester has been added yet, the fixed months above are used instead.
const CAL_TERM_NAMES = { '1st': '1st Semester', '2nd': '2nd Semester', Midyear: 'Midyear' };
// "2026-10-12" → Date at local midnight.
const ymdDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// First moment and last moment of a calendar semester.
const calRange = (s) => {
  const end = ymdDate(s.end_date);
  end.setHours(23, 59, 59);
  return { start: ymdDate(s.start_date), end };
};
// Calendar semesters that have already started, newest first (the dropdown choices).
const startedSemesters = (sems) =>
  sems.filter((s) => ymdDate(s.start_date) <= new Date()).sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
// The calendar semester a date falls in (null if it's during a break).
const calSemesterForDate = (sems, date) =>
  sems.find((s) => {
    const r = calRange(s);
    return date >= r.start && date <= r.end;
  }) || null;
// Finds a calendar semester by its key ("cal-12").
const findCal = (sems, key) => sems.find((s) => `cal-${s.semester_id}` === key);
// A range with no days (used when there is no previous semester to compare with).
const EMPTY_RANGE = { start: new Date(0), end: new Date(0) };

// "Last 7 Days" = today + the 6 days before it (rolling). Admin-only view.
// The mobile app's stats match the "Semester" tab (backend: reportingSemester in index.js).
const WEEK = "Last 7 Days";
const PERIOD_TYPES = [WEEK, "Month", "Semester", "Year"];

const LAST7 = "last7";
const PREV7 = "prev7";
// Start/end of the last 7 days (or the 7 days before that, for comparison).
const rollingWeekRange = (value) => {
  const now = new Date();
  const offset = value === PREV7 ? 7 : 0;
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 - offset, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 23, 59, 59),
  };
};
// Label like "Last 7 days • Sep 22 – Sep 28".
const rollingWeekLabel = (value) => {
  const { start, end } = rollingWeekRange(value);
  // Short date, e.g. "Sep 22".
  const fmt = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${value === PREV7 ? 'Previous 7 days' : 'Last 7 days'} • ${fmt(start)} – ${fmt(end)}`;
};

// Which period (week/month/semester/year) a date belongs to.
//   sems = semesters from the academic calendar (may be empty)
const getPeriodKeyForDate = (periodType, date, sems = []) => {
  if (periodType === WEEK) return LAST7;
  if (periodType === "Month") return monthKey(date);
  if (periodType === "Year") return String(date.getFullYear());
  if (sems.length > 0) {
    const s = calSemesterForDate(sems, date);
    return s ? `cal-${s.semester_id}` : null;
  }
  return semesterKey(date);
};
// Start and end dates of the selected period.
const getPeriodRange = (periodType, value, sems = []) => {
  if (!value) return EMPTY_RANGE;
  if (value.startsWith("cal-")) {
    const s = findCal(sems, value);
    return s ? calRange(s) : EMPTY_RANGE;
  }
  if (periodType === WEEK) return rollingWeekRange(value);
  if (periodType === "Month") return monthRange(value);
  if (periodType === "Year") return yearRange(value);
  return semesterRange(value);
};
// Readable name of the selected period for the dropdown and titles.
const getPeriodLabel = (periodType, value, sems = []) => {
  if (!value) return "—";
  if (value.startsWith("cal-")) {
    const s = findCal(sems, value);
    return s ? `AY ${s.ay_start}-${s.ay_start + 1} • ${CAL_TERM_NAMES[s.term] || s.term}` : "—";
  }
  if (periodType === WEEK) return rollingWeekLabel(value);
  if (periodType === "Month") return monthLabel(value);
  if (periodType === "Year") return `Year ${value}`;
  return semesterLabel(value);
};
// The period just before the selected one (for the ↑/↓ comparisons).
const getPreviousPeriodValue = (periodType, value, sems = []) => {
  if (!value) return null;
  if (value.startsWith("cal-")) {
    // The calendar semester that started just before this one (null if none).
    const ordered = [...sems].sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
    const i = ordered.findIndex((s) => `cal-${s.semester_id}` === value);
    return i > 0 ? `cal-${ordered[i - 1].semester_id}` : null;
  }
  if (periodType === WEEK) return PREV7;
  if (periodType === "Month") {
    const [y, m] = value.split('-').map(Number);
    return monthKey(new Date(y, m - 2, 1));
  }
  if (periodType === "Year") return String(Number(value) - 1);
  return previousSemesterKey(value);
};

// Calm colors (less "rainbow"): every ranked list uses brand green,
// with the #1 item in dark green and the rest in a lighter green.
const BAR_TOP = BRAND.green;
const BAR_REST = "#9DC3A1";
// Colors a ranked bar: first = dark green, others = light green.
const rankColor = (item, i) => (i === 0 ? BAR_TOP : BAR_REST);

const GENDER_LABELS = { male: 'Male', female: 'Female', prefer_not_to_say: 'Other' };
// Two-group comparisons use green + gold (brand colors), gray for "Other".
const GENDER_COLORS = { male: BRAND.green, female: BRAND.gold, prefer_not_to_say: '#9CA3AF' };

const GUEST_TYPE_LABELS = { faculty: 'Faculty', alumni: 'Alumni', walkin: 'Walk-in', student: 'Student' };

const KPI_TOOLTIPS = {
  totalVisits: "Counts every entry log — students and guests — with a visit date inside the selected period.",
  avgDaily: "Total visits in this period ÷ number of days elapsed so far (or the full period length, once it has ended).",
  peakHour: "The 2-hour window with the most entries, based on time-in, across the selected period. The subtitle shows the weekday(s) with the most total visits.",
};

// The Analytics page: library usage trends, peak hours and breakdowns.
const Analytics = () => {
  const [logs, setLogs] = useState([]);
  const [guestLogs, setGuestLogs] = useState([]);
  const [periodType, setPeriodType] = useState("Month");
  const [selectedPeriod, setSelectedPeriod] = useState(monthKey(new Date()));
  const [semesters, setSemesters] = useState([]); // academic calendar from Settings

  // Loads the academic calendar once (for the "Semester" filter).
  useEffect(() => {
    authFetch(`${API_URL}/api/semesters`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSemesters(Array.isArray(data) ? data : []))
      .catch(() => setSemesters([])); // offline → fixed-month semesters
  }, []);

// Loads every student entry/exit log from the server.
  const fetchLogs = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/logs/all`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

// Loads every guest visit from the server.
  const fetchGuestLogs = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/guests/all`);
      const data = await response.json();
      setGuestLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Guest fetch error:", error);
    }
  };

  // Loads the logs when the page opens, then refreshes them every 15 seconds.
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
    if (periodType === WEEK) return [LAST7];
    // Semester with a calendar: every semester that has started, newest first
    // (so the current one is always first and selected by default).
    if (periodType === "Semester" && startedSemesters(semesters).length > 0) {
      return startedSemesters(semesters).map((s) => `cal-${s.semester_id}`);
    }
    const set = new Set([getPeriodKeyForDate(periodType, new Date())]);
    [...logs, ...guestLogs].forEach(l => {
      if (!l.visit_date) return;
      const d = new Date(l.visit_date);
      if (isNaN(d)) return;
      set.add(getPeriodKeyForDate(periodType, d));
    });
    return Array.from(set).sort().reverse();
  }, [logs, guestLogs, periodType, semesters]);

  // Snap to the most recent available period whenever the period TYPE changes
  // (e.g. switching from Month to Semester shouldn't keep a month-shaped value).
  useEffect(() => {
    setSelectedPeriod(prev => (availablePeriods.includes(prev) ? prev : availablePeriods[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, availablePeriods]);

// Start/end dates of the period picked in the filter.
  const periodRange = useMemo(() => getPeriodRange(periodType, selectedPeriod, semesters), [periodType, selectedPeriod, semesters]);

  // Wording for card subtitles: "this month" / "in the last 7 days", etc.
  const periodPhrase = periodType === WEEK ? "in the last 7 days" : `this ${periodType.toLowerCase()}`;
  const periodShort = periodType === WEEK ? "last 7 days" : periodType.toLowerCase();

// Student logs inside the selected period.
  const periodLogs = useMemo(() => {
    return logs.filter(l => {
      if (!l.visit_date) return false;
      const d = new Date(l.visit_date);
      return !isNaN(d) && d >= periodRange.start && d <= periodRange.end;
    });
  }, [logs, periodRange]);

// Guest logs inside the selected period.
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
  const previousPeriodValue = getPreviousPeriodValue(periodType, selectedPeriod, semesters);
// Start/end dates of the previous period (for comparisons).
  const previousPeriodRange = useMemo(() => getPeriodRange(periodType, previousPeriodValue, semesters), [periodType, previousPeriodValue, semesters]);
// All student + guest logs in the previous period.
  const combinedPreviousPeriodEntries = useMemo(() => {
    // True if a log's visit date is inside the previous period.
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

  // Short name of the previous period for "vs …" (calendar semesters: "1st Semester", since
  // two semesters can share the same academic year; others: the part before "•").
  const previousPeriodParts = getPeriodLabel(periodType, previousPeriodValue, semesters).split(' • ');
  const previousPeriodLabel = previousPeriodValue?.startsWith("cal-") ? previousPeriodParts[1] : previousPeriodParts[0];

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
  // button, or the 5:31 PM auto-logout) don't reflect an actual departure
  // time, so they're excluded from this average.
  const exitedPeriodLogs = combinedPeriodEntries.filter(l => l.time_in && l.time_out && !l.forced_exit);
  const totalStayMs = exitedPeriodLogs.reduce((acc, l) => acc + (new Date(l.time_out) - new Date(l.time_in)), 0);
  const avgStay = exitedPeriodLogs.length > 0 ? (totalStayMs / exitedPeriodLogs.length / (1000 * 60 * 60)).toFixed(1) : "0.0";
  const forcedExitCount = combinedPeriodEntries.filter(l => l.time_in && l.time_out && l.forced_exit).length;
  const avgStayTooltip = buildAvgStayTooltip(exitedPeriodLogs.length, totalStayMs, avgStay, forcedExitCount);

  const exitedPreviousPeriod = combinedPreviousPeriodEntries.filter(l => l.time_in && l.time_out && !l.forced_exit);
  const previousPeriodStayMs = exitedPreviousPeriod.reduce((acc, l) => acc + (new Date(l.time_out) - new Date(l.time_in)), 0);
  const avgStayPreviousPeriod = exitedPreviousPeriod.length > 0 ? (previousPeriodStayMs / exitedPreviousPeriod.length / (1000 * 60 * 60)) : null;

  // Entry trend — grouped by week when viewing a single month (W1..W5), or
  // by month when viewing a semester/year (too many weeks to show cleanly).
  const trendData = useMemo(() => {
    if (periodType === WEEK) {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(periodRange.start);
        d.setDate(d.getDate() + i);
        return { key: d.toDateString(), name: d.toLocaleDateString([], { weekday: 'short' }), visits: 0 };
      });
      const byKey = Object.fromEntries(days.map(d => [d.key, d]));
      combinedPeriodEntries.forEach(l => {
        const d = new Date(l.visit_date);
        if (isNaN(d)) return;
        if (byKey[d.toDateString()]) byKey[d.toDateString()].visits += 1;
      });
      return days.map(({ name, visits }) => ({ name, visits }));
    }

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

  const trendTitle = periodType === WEEK ? `Daily entry trend` : periodType === "Month" ? `Weekly entry trend` : `Monthly entry trend`;

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
      .map(c => ({ key: c, name: c, value: counts[c] || 0 }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
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

  const topCollegeName = collegeChartData[0]?.name;
  const topProgramName = programChartData[0]?.name;
  const topGenderEntry = [...genderChartData].sort((a, b) => b.value - a.value)[0];
  const topGuestTypeEntry = [...guestTypeChartData].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          <PageTitle
            title="Analytics"
            subtitle="Library usage trends, peak hours, and demographic breakdown."
            right={
              <>
                <FilterTabs options={PERIOD_TYPES} value={periodType} onChange={setPeriodType} />
                <FilterSelect value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>{getPeriodLabel(periodType, p, semesters)}</option>
                  ))}
                </FilterSelect>
              </>
            }
          />

          {/* KPI CARDS */}
          <div>
            <SectionLabel>{getPeriodLabel(periodType, selectedPeriod, semesters)}</SectionLabel>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
              <KpiCard
                label={`Total Visits (${periodShort})`}
                value={totalVisits}
                color={BRAND.green}
                tooltip={KPI_TOOLTIPS.totalVisits}
                footer={
                  <TrendPill
                    change={visitsTrend}
                    suffix={`${Math.abs(visitsTrend ?? 0)}% vs ${previousPeriodLabel}`}
                    emptyText={periodType === WEEK ? "No data in the previous 7 days" : `No data last ${periodType.toLowerCase()}`}
                  />
                }
              />
              <KpiCard
                label="Avg. Daily Visits"
                value={avgDailyVisits}
                color={BRAND.deep}
                tooltip={KPI_TOOLTIPS.avgDaily}
                footer={<span className="text-xs text-gray-500">Weekdays and weekends</span>}
              />
              <KpiCard
                label="Peak Hour"
                value={peakLabel}
                color={BRAND.goldText}
                tooltip={KPI_TOOLTIPS.peakHour}
                footer={<span className="text-xs text-gray-500">{busiestDaysLabel}</span>}
              />
              <KpiCard
                label="Avg. Stay Duration"
                value={avgStay}
                unit="hr"
                color={BRAND.deep}
                tooltip={avgStayTooltip}
                footer={
                  <TrendPill
                    change={avgStayPreviousPeriod === null ? null : parseFloat(avgStay) - avgStayPreviousPeriod}
                    suffix={`vs ${avgStayPreviousPeriod?.toFixed(1)} hr ${previousPeriodLabel}`}
                    emptyText="Based on exits"
                  />
                }
              />
            </div>
          </div>

          {/* Trend + Peak hours heatmap */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card className="p-6">
              <CardTitle title={trendTitle.charAt(0).toUpperCase() + trendTitle.slice(1)} note="Students and guests" />
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      {/* Soft green fade under the line */}
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BRAND.green} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={BRAND.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F1" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: "#6B7280" }} />
                    <YAxis fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF" }} />
                    <Tooltip content={<ChartTooltip unit="visits" />} />
                    <Area type="monotone" dataKey="visits" stroke={BRAND.green} fill="url(#trendFill)" strokeWidth={2.5} name="Visitors" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <CardTitle title="Peak Hours" note="Visits per hour · students and guests" />
              <div className="grid gap-1" style={{ gridTemplateColumns: `36px repeat(${HOURS.length}, 1fr)` }}>
                {heatmapMatrix.map((row, dayIdx) => (
                  <React.Fragment key={dayIdx}>
                    <div className="text-[11px] text-gray-500 flex items-center" style={{ height: "24px" }}>{WEEKDAY_LABELS[dayIdx]}</div>
                    {row.map((count, hourIdx) => {
                      // Darker green = busier hour.
                      const intensity = count === 0 ? 0.05 : 0.15 + (count / heatmapMax) * 0.8;
                      return (
                        // Styled hover bubble instead of the browser's plain tooltip
                        <HoverTooltip
                          key={`${dayIdx}-${hourIdx}`}
                          className="w-full"
                          label={<HeatCellTip dayIdx={dayIdx} hour={HOURS[hourIdx]} count={count} />}
                        >
                          <div
                            className="w-full rounded-[6px] cursor-default transition-transform hover:scale-110 hover:ring-2 hover:ring-[#1B5E20]/30"
                            style={{ height: "24px", backgroundColor: `rgba(27, 94, 32, ${intensity})` }}
                          />
                        </HoverTooltip>
                      );
                    })}
                  </React.Fragment>
                ))}

                {/* Hour labels under the grid */}
                <div />
                {HOURS.map((h, i) => (
                  <div key={h} className="text-[10px] text-gray-400 text-center">
                    {i % 2 === 0 ? formatHour(h) : ""}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-4 text-[11px] text-gray-500">
                <span>Low</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: "linear-gradient(to right, rgba(27,94,32,0.05), rgba(27,94,32,0.95))" }} />
                <span>High</span>
              </div>
            </Card>
          </div>

          {/* Visits by College & Programs */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <Card className="p-6">
              <CardTitle
                title="Visits by College"
                note={topCollegeName ? `${topCollegeName} leads ${periodPhrase} · students only` : "No student visits yet"}
              />
              <StatBarList data={collegeChartData} colorFor={rankColor} emptyLabel={`No visits recorded ${periodPhrase}`} />
            </Card>

            <Card className="p-6">
              <CardTitle
                title="Highest Program by Visits"
                note={topProgramName ? `${topProgramName} leads ${periodPhrase} · students only` : "No student visits yet"}
              />
              <StatBarList data={programChartData} colorFor={rankColor} emptyLabel={`No visits recorded ${periodPhrase}`} />
            </Card>
          </div>

          {/* New vs Returning & Top Visiting Students */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <Card className="p-6">
              <CardTitle
                title="New vs Returning Students"
                note={totalUniqueStudents > 0 ? `${returningPct}% of visiting students ${periodPhrase} are returning` : "No student visits yet"}
              />
              <StatBarList
                data={newReturningData}
                colorFor={(item) => (item.key === "returning" ? BRAND.green : BRAND.gold)}
                emptyLabel={`No visits recorded ${periodPhrase}`}
              />
            </Card>

            <Card className="p-6">
              <CardTitle title="Top Visiting Students" note="Students only" />
              {topStudents.length === 0 ? (
                <EmptyState text={`No visits recorded ${periodPhrase}`} />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] border-b border-[#F1F3F1]">
                      <th className="pb-2.5">#</th>
                      <th className="pb-2.5">Student No.</th>
                      <th className="pb-2.5">College</th>
                      <th className="pb-2.5">Visits</th>
                      <th className="pb-2.5">Avg Stay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F1]">
                    {topStudents.map((s, i) => (
                      <tr key={i}>
                        <td className="py-2.5 text-gray-400 tabular-nums">{i + 1}</td>
                        <td className="py-2.5 font-semibold text-gray-900 tabular-nums">{s.studentNumber}</td>
                        <td className="py-2.5 text-gray-500">{s.college}</td>
                        <td className="py-2.5 font-bold text-[#1B5E20] tabular-nums">{s.visits}</td>
                        <td className="py-2.5 text-gray-500 tabular-nums">{s.avgStay === "--" ? "--" : `${s.avgStay} hr`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          {/* Guest Types & Gender */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <Card className="p-6">
              <CardTitle
                title="Guest Type Comparison"
                note={topGuestTypeEntry ? `${topGuestTypeEntry.name} visits the most ${periodPhrase}` : "No guest visits yet"}
              />
              <StatBarList
                data={[...guestTypeChartData].sort((a, b) => b.value - a.value)}
                colorFor={rankColor}
                emptyLabel={`No guest visits recorded ${periodPhrase}`}
              />
            </Card>

            <Card className="p-6">
              <CardTitle
                title="Gender Comparison"
                note={topGenderEntry ? `${topGenderEntry.name} makes up the most visits ${periodPhrase} · students only` : "No student visits yet"}
              />
              <StatBarList
                data={genderChartData}
                colorFor={(item) => GENDER_COLORS[item.key] || "#9CA3AF"}
                emptyLabel={`No visits recorded ${periodPhrase}`}
              />
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Analytics;