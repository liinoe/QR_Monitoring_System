import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SOON_DAYS = 14; // start warning this many days before the semester ends

// Today as "YYYY-MM-DD" (local date).
const todayYmd = () => new Date().toLocaleDateString("en-CA");
// Whole days from date a to date b ("YYYY-MM-DD").
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
// "2026-10-13" → "Oct 13, 2026".
const formatDay = (ymd) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Decides which reminder to show (or null):
//   "soon"  the current semester ends within 14 days and no next semester is on the calendar
//   "break" no semester is running and none is scheduled → returning students can't renew
// Shows nothing when the calendar is empty (the system then runs without semesters).
export const calendarReminder = (semesters) => {
  if (!semesters || semesters.length === 0) return null;
  const today = todayYmd();
  const active = semesters.find((s) => s.status === "active");
  const upcoming = semesters.find((s) => s.status === "upcoming");
  if (upcoming) return null;
  if (active) {
    const daysLeft = daysBetween(today, active.end_date);
    if (daysLeft <= SOON_DAYS) return { level: "soon", semester: active, daysLeft };
    return null;
  }
  const lastEnded = [...semesters].filter((s) => s.status === "ended").sort((a, b) => (a.end_date < b.end_date ? 1 : -1))[0];
  return lastEnded ? { level: "break", semester: lastEnded } : null;
};

// Reminder banner for the Super Admin to add the next semester before students get stuck.
//   semesters  calendar list (if not given, it loads /api/semesters itself)
//   inSettings true on the Settings page: no button (the page already has "+ Add Semester");
//              elsewhere an "Add Semester" button links to Settings
const CalendarReminder = ({ semesters: given, inSettings = false }) => {
  const [loaded, setLoaded] = useState([]);

  // Loads the calendar when no list was passed in (e.g. on the Dashboard).
  useEffect(() => {
    if (given) return;
    authFetch(`${API_URL}/api/semesters`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setLoaded(Array.isArray(data) ? data : []))
      .catch(() => setLoaded([]));
  }, [given]);

  const reminder = calendarReminder(given || loaded);
  if (!reminder) return null;

  const isBreak = reminder.level === "break";
  const title = isBreak
    ? "No semester is running and none is scheduled"
    : `${reminder.semester.name} ends ${reminder.daysLeft <= 0 ? "today" : `in ${reminder.daysLeft} ${reminder.daysLeft === 1 ? "day" : "days"}`} (${formatDay(reminder.semester.end_date)})`;
  const message = isBreak
    ? `${reminder.semester.name} ended on ${formatDay(reminder.semester.end_date)}. Returning students' passes have expired and they can't renew until you add the next semester.`
    : "No next semester is on the calendar yet. After the end date, students can't renew their passes until you add it.";

  const buttonClass = `rounded-full bg-white px-5 py-2 text-sm font-bold border transition-colors whitespace-nowrap ${
    isBreak ? "text-[#B3261E] border-[#F2B8B5] hover:bg-[#FFF5F4]" : "text-[#946800] border-[#F0D98A] hover:bg-[#FFFBEF]"
  }`;

  return (
    <div className={`flex items-center justify-between gap-4 flex-wrap rounded-[12px] px-5 py-4 ${isBreak ? "bg-[#FBDFDB]" : "bg-[#FBF1CE]"}`}>
      <div className="flex items-start gap-3 min-w-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isBreak ? "#B3261E" : "#946800"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <div className="min-w-0">
          <p className={`text-sm font-bold ${isBreak ? "text-[#B3261E]" : "text-[#946800]"}`}>{title}</p>
          <p className={`text-xs mt-0.5 ${isBreak ? "text-[#B3261E]/80" : "text-[#946800]/80"}`}>{message}</p>
        </div>
      </div>
      {!inSettings && <Link to="/settings" className={buttonClass}>Add Semester</Link>}
    </div>
  );
};

export default CalendarReminder;
