import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import FilterSelect from "../../components/FilterSelect";
import DatePicker from "../../components/DatePicker";
import CalendarReminder from "../../components/CalendarReminder";
import { authFetch, isSuperAdmin, getAdmin } from "../../auth";
import { BRAND, PageTitle, Card, CardTitle, SectionLabel, Pill, Dialog, btn } from "../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TERM_OPTIONS = [
  { value: "1st", label: "1st Semester" },
  { value: "2nd", label: "2nd Semester" },
  { value: "Midyear", label: "Midyear" },
];
const TERM_NAMES = { "1st": "1st Semester", "2nd": "2nd Semester", Midyear: "Midyear" };

// Same input look as the other admin forms.
const inputClass =
  "w-full bg-white border border-[#E3E7E3] rounded-[12px] px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition focus:border-[#1B5E20] focus:ring-4 focus:ring-[#1B5E20]/10 disabled:bg-[#F4F5F4] disabled:text-gray-400";

// "2026-08-10" → a Date at local midnight (avoids timezone shifts).
const toDate = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// "2026-08-10" → "Aug 10, 2026".
const formatDay = (ymd) =>
  ymd ? toDate(ymd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// Whole days from date a to date b ("YYYY-MM-DD").
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

// "2nd", 2026 → "2nd Semester A.Y. 2026-2027" (same as the server builds it).
const buildName = (term, ayStart) => `${TERM_NAMES[term]} A.Y. ${ayStart}-${Number(ayStart) + 1}`;

// Suggests the next term after the latest one on the calendar (1st → 2nd → 1st of next A.Y.).
const suggestNext = (semesters) => {
  const latest = [...semesters].sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0];
  const now = new Date();
  if (!latest) return { term: now.getMonth() >= 7 ? "1st" : "2nd", ay_start: now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1 };
  if (latest.term === "1st") return { term: "2nd", ay_start: latest.ay_start };
  return { term: "1st", ay_start: latest.ay_start + 1 };
};

// Look of each semester status.
const SEM_STATUS = {
  active: { tone: "green", label: "In session" },
  upcoming: { tone: "gold", label: "Upcoming" },
  ended: { tone: "gray", label: "Ended" },
};

// Super admin settings: academic calendar (semester dates) and staff accounts.
const Settings = () => {
  const superAdmin = isSuperAdmin();

  // ---- Staff accounts ----
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "admin" });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const myId = getAdmin()?.admin_id;
  // Password made by the server, shown ONCE: { title, email, password }
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toReset, setToReset] = useState(null); // staff row waiting for "Reset password?" confirm
  const [resetting, setResetting] = useState(false);
  // Archive / restore confirm: { type: "archive" | "restore", staff }
  const [toArchive, setToArchive] = useState(null);
  const [archiving, setArchiving] = useState(false);

  // ---- Academic calendar ----
  const [calendar, setCalendar] = useState(null);
  // Add / edit pop-up: { mode: "add" | "edit", semester_id?, term, ay_start, start_date, end_date, status? }
  const [semForm, setSemForm] = useState(null);
  const [semError, setSemError] = useState("");
  const [savingSem, setSavingSem] = useState(false);
  // Pop-ups: confirm (start date already reached), remove confirm, and result messages.
  const [confirmStart, setConfirmStart] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [notice, setNotice] = useState(null);
  // Undo a semester that ended by mistake: the corrected end date the admin picks.
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoEnd, setUndoEnd] = useState("");
  const [undoError, setUndoError] = useState("");
  const [undoing, setUndoing] = useState(false);

  // Gets the semesters, the current one, and how many students are approved / expired.
  const loadCalendar = async () => {
    if (!superAdmin) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/semesters`);
      if (res.ok) setCalendar(await res.json());
    } catch (err) {
      console.error("Failed to load semesters:", err);
    }
  };

  // Gets the list of admin / staff accounts.
  const loadStaff = async () => {
    if (!superAdmin) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/staff`);
      if (res.ok) setStaff(await res.json());
    } catch (err) {
      console.error("Failed to load staff:", err);
    }
  };

  // Load both once when the page opens.
  useEffect(() => {
    loadStaff();
    loadCalendar();
  }, []);

  // "+ Add Semester": opens the form with the next term already picked.
  const openAdd = () => {
    const next = suggestNext(calendar?.semesters || []);
    setSemForm({ mode: "add", ...next, start_date: "", end_date: "" });
    setSemError("");
  };

  // "Edit dates" on a row.
  const openEdit = (s) => {
    setSemForm({ mode: "edit", semester_id: s.semester_id, term: s.term, ay_start: s.ay_start, start_date: s.start_date, end_date: s.end_date, status: s.status });
    setSemError("");
  };

  // "Save": checks the dates, asks to confirm if the semester starts today or earlier, then saves.
  const handleSaveSemester = (e) => {
    e.preventDefault();
    if (!semForm.start_date || !semForm.end_date) return setSemError("Please pick a start date and an end date.");
    if (semForm.end_date <= semForm.start_date) return setSemError("The end date must be after the start date.");
    const startsNow = semForm.status !== "active" && semForm.start_date <= calendar.today;
    if (startsNow) return setConfirmStart(true);
    saveSemester();
  };

  // Sends the new or edited semester to the server.
  const saveSemester = async () => {
    setConfirmStart(false);
    setSavingSem(true);
    setSemError("");
    try {
      const isEdit = semForm.mode === "edit";
      const res = await authFetch(`${API_URL}/api/admin/semesters${isEdit ? `/${semForm.semester_id}` : ""}`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: semForm.term,
          ay_start: semForm.ay_start,
          start_date: semForm.start_date,
          end_date: semForm.end_date,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setSemError(data.message || "Could not save the semester.");
      setSemForm(null);
      setNotice({ tone: "success", title: isEdit ? "Dates Updated" : "Semester Added", message: data.message });
      loadCalendar();
    } catch {
      setSemError("Could not reach the server.");
    } finally {
      setSavingSem(false);
    }
  };

  // "Undo": reopens the semester that just ended with the corrected end date.
  const undoEndOfSemester = async () => {
    if (!undoEnd) return setUndoError("Please pick the correct end date.");
    setUndoing(true);
    setUndoError("");
    try {
      const res = await authFetch(`${API_URL}/api/admin/semesters/undo-end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transition_id: calendar.undo.transition_id, end_date: undoEnd }),
      });
      const data = await res.json();
      if (!res.ok) return setUndoError(data.message || "Could not undo.");
      setUndoOpen(false);
      setNotice({ tone: "success", title: "Semester Reopened", message: data.message });
      loadCalendar();
    } catch {
      setUndoError("Could not reach the server.");
    } finally {
      setUndoing(false);
    }
  };

  // Deletes a semester that hasn't started (after the admin confirms).
  const removeSemester = async () => {
    const s = toRemove;
    setToRemove(null);
    try {
      const res = await authFetch(`${API_URL}/api/admin/semesters/${s.semester_id}`, { method: "DELETE" });
      const data = await res.json();
      setNotice(res.ok
        ? { tone: "success", title: "Semester Removed", message: data.message }
        : { tone: "error", title: "Couldn't Remove", message: data.message || "Please try again." });
      loadCalendar();
    } catch {
      setNotice({ tone: "error", title: "Can't Reach the Server", message: "Please try again." });
    }
  };

  // Updates one staff-form field as the admin types.
  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Shows the generated password pop-up (Copy button resets each time).
  const showIssued = (title, email, password) => {
    setCopied(false);
    setIssued({ title, email, password });
  };

  // "Copy": puts the generated password on the clipboard.
  const copyPassword = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(issued.password);
      } else {
        // http:// on the local network: the new clipboard API is off, so use the older way
        const box = document.createElement("textarea");
        box.value = issued.password;
        document.body.appendChild(box);
        box.select();
        document.execCommand("copy");
        box.remove();
      }
      setCopied(true);
    } catch {
      setCopied(false); // copy blocked — they can still select the password and copy it
    }
  };

  // "Reset password" confirm → server makes a new password and signs that account out.
  const handleResetPassword = async () => {
    const target = toReset;
    setResetting(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/staff/${target.admin_id}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setToReset(null);
      if (!res.ok) {
        setNotice({ tone: "error", title: "Couldn't Reset Password", message: data.message || "Please try again." });
        return;
      }
      showIssued("Password reset", data.email, data.temp_password);
      loadStaff();
    } catch {
      setToReset(null);
      setNotice({ tone: "error", title: "Can't Reach the Server", message: "Please try again." });
    } finally {
      setResetting(false);
    }
  };

  // "Archive" / "Restore" confirm → server turns the account's sign-in off or back on.
  // Archiving also signs that account out of every browser.
  const handleArchiveToggle = async () => {
    const { type, staff: target } = toArchive;
    setArchiving(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/staff/${target.admin_id}/${type}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setToArchive(null);
      if (!res.ok) {
        setNotice({
          tone: "error",
          title: type === "archive" ? "Couldn't Archive Account" : "Couldn't Restore Account",
          message: data.message || "Please try again.",
        });
        return;
      }
      setNotice({
        tone: "success",
        title: type === "archive" ? "Account Archived" : "Account Restored",
        message: data.message,
      });
      loadStaff();
    } catch {
      setToArchive(null);
      setNotice({ tone: "error", title: "Can't Reach the Server", message: "Please try again." });
    } finally {
      setArchiving(false);
    }
  };

  // "Create Account": adds a new admin / staff account. The server makes the password.
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to create account.");
        return;
      }
      setForm({ name: "", email: "", role: "admin" });
      setShowForm(false);
      showIssued("Account created", data.email, data.temp_password);
      loadStaff();
    } catch (err) {
      console.error(err);
      setError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  };

  const active = calendar?.active;
  const next = calendar?.next;
  const today = calendar?.today;
  // A.Y. choices for a new semester. With semesters on the calendar: the latest one's
  // academic year and the next one (a new semester can't go back to an older year).
  // Empty calendar: last year, this year and next year (the school year may have started
  // last calendar year, e.g. 2nd Semester of 2025-2026 running in March 2026).
  const thisYear = new Date().getFullYear();
  const latestAy = Math.max(0, ...(calendar?.semesters || []).map((s) => s.ay_start));
  const ayOptions = latestAy
    ? [latestAy, latestAy + 1]
    : [thisYear - 1, thisYear, thisYear + 1];
  // Editing keeps the semester's own year in the list (the field is locked anyway).
  if (semForm?.ay_start && !ayOptions.includes(semForm.ay_start)) ayOptions.unshift(semForm.ay_start);

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          <PageTitle title="System Settings" subtitle="Academic calendar and staff accounts." />

          {/* ACADEMIC CALENDAR — super admin only */}
          {superAdmin && (
            <div>
              <SectionLabel>Academic calendar</SectionLabel>
              <Card className="p-6 space-y-6">
                {/* Current semester / break status */}
                <div className="flex items-start justify-between gap-6 flex-wrap">
                  <div className="flex-1 min-w-[280px]">
                    {!calendar ? (
                      <p className="text-sm text-gray-400">Loading...</p>
                    ) : active ? (
                      <ActiveSemester active={active} today={today} approved={calendar.approved_count} />
                    ) : (
                      <SemesterBreak next={next} today={today} expired={calendar.expired_count} currentPeriod={calendar.current_period} />
                    )}
                  </div>
                  <button onClick={openAdd} disabled={!calendar} className={btn.primary}>
                    + Add Semester
                  </button>
                </div>

                {/* Reminder to add the next semester (ending soon / break with nothing scheduled) */}
                {calendar && <CalendarReminder semesters={calendar.semesters} inSettings />}

                {/* Undo banner: shows during the break, up to 7 days after a semester ended */}
                {calendar?.undo && (
                  <div className="flex items-center justify-between gap-4 flex-wrap rounded-[16px] bg-[#FBF1CE] px-5 py-4">
                    <div>
                      <p className="text-sm font-bold text-[#946800]">
                        {calendar.undo.name} ended on {formatDay(calendar.undo.end_date)} · {calendar.undo.affected_count} {calendar.undo.affected_count === 1 ? "pass" : "passes"} expired
                      </p>
                      <p className="text-xs text-[#946800]/80 mt-0.5">
                        Wrong end date? You can undo this until {formatDay(calendar.undo.available_until)}, or until the next semester starts.
                      </p>
                    </div>
                    <button
                      onClick={() => { setUndoEnd(""); setUndoError(""); setUndoOpen(true); }}
                      className="rounded-full bg-white text-[#946800] px-5 py-2 text-sm font-bold border border-[#F0D98A] hover:bg-[#FFFBEF] transition-colors"
                    >
                      Undo
                    </button>
                  </div>
                )}

                {/* How it works */}
                <div className="rounded-[14px] bg-[#F7F8F7] px-4 py-3 text-xs text-gray-600 leading-relaxed">
                  <span className="font-bold text-gray-800">How it works: </span>
                  the day after a semester's <b>end date</b>, every approved QR pass expires automatically. On the next
                  semester's <b>start date</b>, students can renew in the app and you approve them on the Registrations page.
                </div>

                {/* Semester list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] border-b border-[#F1F3F1]">
                        <th className="pb-3 text-left">Semester</th>
                        <th className="pb-3 text-left">Dates</th>
                        <th className="pb-3 text-left">Status</th>
                        <th className="pb-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F3F1]">
                      {calendar && calendar.semesters.length === 0 && (
                        <tr><td colSpan={4} className="py-10 text-center text-gray-400">No semesters yet. Add the current semester to get started.</td></tr>
                      )}
                      {calendar?.semesters.map((s) => (
                        <tr key={s.semester_id}>
                          <td className="py-3 font-semibold text-gray-900">{s.name}</td>
                          <td className="py-3 text-gray-600 tabular-nums">{formatDay(s.start_date)} – {formatDay(s.end_date)}</td>
                          <td className="py-3"><Pill tone={SEM_STATUS[s.status].tone}>{SEM_STATUS[s.status].label}</Pill></td>
                          <td className="py-3 text-right whitespace-nowrap">
                            {s.status !== "ended" && (
                              <button onClick={() => openEdit(s)} className="rounded-full bg-[#E8F1E9] text-[#1B5E20] px-4 py-1.5 text-xs font-bold hover:bg-[#dbe9dc] transition-colors">
                                Edit dates
                              </button>
                            )}
                            {s.status === "upcoming" && (
                              <button onClick={() => setToRemove(s)} className="ml-2 rounded-full bg-[#F1F3F1] text-gray-600 px-4 py-1.5 text-xs font-bold hover:bg-[#FBDFDB] hover:text-[#B3261E] transition-colors">
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* STAFF ACCOUNTS — super admin only */}
          {superAdmin && (
            <div>
              <SectionLabel>Staff accounts</SectionLabel>
              <Card className="p-6">
                <CardTitle
                  title="Manage Staff Accounts"
                  note="Create accounts, reset forgotten passwords, and archive accounts of staff who no longer need access."
                  right={
                    <button onClick={() => setShowForm(!showForm)} className={showForm ? btn.secondary : btn.primary}>
                      {showForm ? "Cancel" : "+ New Account"}
                    </button>
                  }
                />

                {showForm && (
                  <form onSubmit={handleCreateStaff} className="rounded-[16px] bg-[#F7F8F7] p-4 mb-5 space-y-3">
                    {error && <div className="rounded-[12px] bg-[#FBDFDB] text-[#B3261E] text-sm font-semibold px-4 py-2.5">{error}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input name="name" placeholder="Full Name" required value={form.name} onChange={handleFormChange} className={inputClass} />
                      <input name="email" type="email" placeholder="Email" required value={form.email} onChange={handleFormChange} className={inputClass} />
                      <FilterSelect fullWidth value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                        <option value="admin">Library Staff</option>
                        <option value="super_admin">Super Admin</option>
                      </FilterSelect>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" disabled={creating} className={btn.primary}>
                        {creating ? "Creating..." : "Create Account"}
                      </button>
                      <p className="text-xs text-gray-500">A password is made for you to copy and give to the staff member.</p>
                    </div>
                  </form>
                )}

                <div className="responsive-table-container">
                  <table className="responsive-table settings-staff-table w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] border-b border-[#F1F3F1]">
                        <th className="pb-3 text-left">Name</th>
                        <th className="pb-3 text-left">Email</th>
                        <th className="pb-3 text-left">Role</th>
                        <th className="pb-3 text-left">Status</th>
                        <th className="pb-3 text-left">Password</th>
                        <th className="pb-3 text-left">Created</th>
                        <th className="pb-3 text-right"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F3F1]">
                      {staff.map((s) => (
                        <tr key={s.admin_id} className={s.is_archived ? "opacity-60" : ""}>
                          <td className="py-3 font-semibold text-gray-900">{s.name}</td>
                          <td className="py-3 text-gray-600">{s.email}</td>
                          <td className="py-3">
                            <Pill tone={s.role === "super_admin" ? "gold" : "green"}>{s.role === "super_admin" ? "Super Admin" : "Library Staff"}</Pill>
                          </td>
                          <td className="py-3">
                            {s.is_archived ? <Pill tone="gray">Archived</Pill> : <Pill tone="green">Active</Pill>}
                          </td>
                          <td className="py-3">
                            {s.password_is_temp ? <Pill tone="gold">Given by admin</Pill> : <Pill tone="gray">Own password</Pill>}
                          </td>
                          <td className="py-3 text-gray-500 tabular-nums">{new Date(s.created_at).toLocaleDateString()}</td>
                          <td className="py-3 text-right">
                            {s.admin_id === myId ? (
                              <span className="text-xs text-gray-400">You</span>
                            ) : s.is_archived ? (
                              <button
                                type="button"
                                onClick={() => setToArchive({ type: "restore", staff: s })}
                                className="text-[13px] font-semibold text-[#1B5E20] px-3 py-1.5 rounded-[10px] hover:bg-[#E8F1E9] transition-colors whitespace-nowrap"
                              >
                                Restore
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setToReset(s)}
                                  className="text-[13px] font-semibold text-[#1B5E20] px-3 py-1.5 rounded-[10px] hover:bg-[#E8F1E9] transition-colors whitespace-nowrap"
                                >
                                  Reset password
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setToArchive({ type: "archive", staff: s })}
                                  className="text-[13px] font-semibold text-[#B3261E] px-3 py-1.5 rounded-[10px] hover:bg-[#FBDFDB] transition-colors whitespace-nowrap"
                                >
                                  Archive
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* RESET STAFF PASSWORD — confirm */}
      <Dialog
        open={!!toReset}
        tone="warning"
        title="Reset password?"
        message={toReset ? `${toReset.name} will get a new password and be signed out of every browser. Their old password stops working.` : ""}
        footer={
          <>
            <button type="button" onClick={() => setToReset(null)} className={btn.secondary}>Cancel</button>
            <button type="button" disabled={resetting} onClick={handleResetPassword} className={btn.primary}>
              {resetting ? "Resetting…" : "Reset Password"}
            </button>
          </>
        }
      />

      {/* ARCHIVE / RESTORE STAFF ACCOUNT — confirm */}
      <Dialog
        open={!!toArchive}
        tone={toArchive?.type === "archive" ? "error" : "warning"}
        title={toArchive?.type === "archive" ? "Archive this account?" : "Restore this account?"}
        message={
          !toArchive
            ? ""
            : toArchive.type === "archive"
              ? `${toArchive.staff.name} will be signed out and won't be able to sign in. Their records stay, and you can restore the account anytime.`
              : `${toArchive.staff.name} will be able to sign in again with their current password.`
        }
        footer={
          <>
            <button type="button" onClick={() => setToArchive(null)} className={btn.secondary}>Cancel</button>
            <button
              type="button"
              disabled={archiving}
              onClick={handleArchiveToggle}
              className={toArchive?.type === "archive" ? btn.danger : btn.primary}
            >
              {archiving ? "Please wait…" : toArchive?.type === "archive" ? "Archive" : "Restore"}
            </button>
          </>
        }
      />

      {/* GENERATED PASSWORD — shown once, after creating or resetting an account */}
      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A0F]/40 backdrop-blur-sm">
          <div className="w-full max-w-[420px] bg-white rounded-[24px] shadow-2xl p-7">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#E8F1E9] text-[#1B5E20] flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" />
                </svg>
              </div>
              <h3 className="text-[19px] font-bold text-gray-900">{issued.title}</h3>
              <p className="text-sm text-gray-500 mt-1">
                Password for <span className="font-semibold text-gray-800">{issued.email}</span>
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-[14px] bg-[#F7F8F7] pl-4 pr-2 h-[56px]">
              <span className="flex-1 font-mono text-[19px] font-bold tracking-[0.12em] text-gray-900 select-all">{issued.password}</span>
              <button type="button" onClick={copyPassword} className={copied ? btn.secondary : btn.primary}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>

            <p className="mt-4 rounded-[14px] bg-[#FBF3DC] text-[#946800] text-[12.5px] leading-relaxed px-4 py-3 text-center">
              Copy it now. It won't be shown again. After signing in, they can keep it or change it to their own.
            </p>

            <button type="button" onClick={() => setIssued(null)} className={`${btn.secondary} w-full mt-5`}>Done</button>
          </div>
        </div>
      )}

      {/* ADD / EDIT SEMESTER POP-UP */}
      {semForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A0F]/40 backdrop-blur-sm" onClick={() => setSemForm(null)}>
          <form onSubmit={handleSaveSemester} onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] bg-white rounded-[24px] shadow-2xl p-7 space-y-5">
            <div>
              <h3 className="text-[19px] font-bold text-gray-900">{semForm.mode === "add" ? "Add Semester" : "Edit Semester Dates"}</h3>
              <p className="text-sm text-gray-500 mt-1">Use the dates from the official school calendar.</p>
            </div>

            {semError && <div className="rounded-[12px] bg-[#FBDFDB] text-[#B3261E] text-sm font-semibold px-4 py-2.5">{semError}</div>}

            {/* Term + academic year (locked when editing) */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Term">
                <FilterSelect fullWidth disabled={semForm.mode === "edit"} value={semForm.term} onChange={(e) => setSemForm({ ...semForm, term: e.target.value })}>
                  {TERM_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </FilterSelect>
              </Field>
              <Field label="Academic Year">
                <FilterSelect fullWidth disabled={semForm.mode === "edit"} value={semForm.ay_start} onChange={(e) => setSemForm({ ...semForm, ay_start: Number(e.target.value) })}>
                  {ayOptions.map((y) => <option key={y} value={y}>{y}-{y + 1}</option>)}
                </FilterSelect>
              </Field>
            </div>

            {/* Dates (the current semester can only move its end date) */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <DatePicker
                  value={semForm.start_date}
                  disabled={semForm.status === "active"}
                  rangeStart={semForm.start_date}
                  rangeEnd={semForm.end_date}
                  placeholder="Pick start date"
                  onChange={(v) => setSemForm({ ...semForm, start_date: v })}
                />
              </Field>
              <Field label="End date">
                <DatePicker
                  value={semForm.end_date}
                  min={semForm.start_date || undefined}
                  rangeStart={semForm.start_date}
                  rangeEnd={semForm.end_date}
                  placeholder="Pick end date"
                  onChange={(v) => setSemForm({ ...semForm, end_date: v })}
                />
              </Field>
            </div>

            {/* Preview of the name students will see */}
            <div className="rounded-[14px] bg-[#E8F1E9] px-4 py-3">
              <p className="text-[11px] font-bold text-[#1B5E20] uppercase tracking-[0.06em]">Shown as</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{buildName(semForm.term, semForm.ay_start)}</p>
              {semForm.start_date && semForm.end_date && semForm.end_date > semForm.start_date && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {formatDay(semForm.start_date)} – {formatDay(semForm.end_date)} · {daysBetween(semForm.start_date, semForm.end_date) + 1} days
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setSemForm(null)} className={`${btn.secondary} flex-1`}>Cancel</button>
              <button type="submit" disabled={savingSem} className={`${btn.primary} flex-1`}>{savingSem ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm: the start date is today or earlier, so it starts right away */}
      <Dialog
        open={confirmStart}
        tone="warning"
        title="Start This Semester Now?"
        message={
          semForm ? (
            buildName(semForm.term, semForm.ay_start) === calendar?.current_period ? (
              <>
                {buildName(semForm.term, semForm.ay_start)} is already the current period, so <b>no one has to renew</b>.
                Start date: <b>{formatDay(semForm.start_date)}</b>.
              </>
            ) : (
              <>
                {buildName(semForm.term, semForm.ay_start)} starts right away.{" "}
                <b className="text-gray-900">
                  {(calendar?.approved_count || 0) + (calendar?.expired_count || 0)} students
                </b>{" "}
                will need to renew their pass today. Please check the start date:{" "}
                <b className="text-gray-900">{formatDay(semForm.start_date)}</b>.
              </>
            )
          ) : ""
        }
        footer={
          <>
            <button onClick={() => setConfirmStart(false)} className={btn.secondary}>Go Back</button>
            <button onClick={saveSemester} className={btn.primary}>Yes, Save</button>
          </>
        }
      />

      {/* UNDO POP-UP: pick the correct end date, then reopen */}
      {undoOpen && calendar?.undo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A0F]/40 backdrop-blur-sm" onClick={() => setUndoOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] bg-white rounded-[24px] shadow-2xl p-7 space-y-5">
            <div>
              <h3 className="text-[19px] font-bold text-gray-900">Undo End of Semester</h3>
              <p className="text-sm text-gray-500 mt-1">
                {calendar.undo.name} will be open again. {calendar.undo.affected_count} {calendar.undo.affected_count === 1 ? "student gets their pass" : "students get their passes"} back
                with the same QR code — nothing to do on their side.
              </p>
            </div>
            {undoError && <div className="rounded-[12px] bg-[#FBDFDB] text-[#B3261E] text-sm font-semibold px-4 py-2.5">{undoError}</div>}
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-gray-600">What's the correct end date?</span>
              <DatePicker
                value={undoEnd}
                min={calendar.today}
                rangeStart={calendar.undo.start_date}
                rangeEnd={undoEnd}
                placeholder="Pick the correct end date"
                onChange={setUndoEnd}
              />
              <span className="text-xs text-gray-400">Started {formatDay(calendar.undo.start_date)}. The new end date must be today or later.</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setUndoOpen(false)} className={`${btn.secondary} flex-1`}>Cancel</button>
              <button onClick={undoEndOfSemester} disabled={undoing} className={`${btn.primary} flex-1`}>
                {undoing ? "Reopening..." : "Undo & Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm remove */}
      <Dialog
        open={!!toRemove}
        tone="warning"
        title="Remove Semester?"
        message={toRemove ? `${toRemove.name} (${formatDay(toRemove.start_date)} – ${formatDay(toRemove.end_date)}) will be removed from the calendar.` : ""}
        footer={
          <>
            <button onClick={() => setToRemove(null)} className={btn.secondary}>Cancel</button>
            <button onClick={removeSemester} className={btn.danger}>Yes, Remove</button>
          </>
        }
      />

      {/* Result pop-up */}
      <Dialog
        open={!!notice}
        tone={notice?.tone}
        title={notice?.title}
        message={notice?.message}
        footer={<button onClick={() => setNotice(null)} className={btn.primary}>OK</button>}
      />
    </div>
  );
};

// The current semester: name, dates, a progress bar and what happens at the end.
const ActiveSemester = ({ active, today, approved }) => {
  const total = daysBetween(active.start_date, active.end_date) + 1;
  const done = Math.min(total, Math.max(0, daysBetween(active.start_date, today) + 1));
  const left = total - done;
  return (
    <div>
      <div className="flex items-center gap-2">
        <Pill tone="green" dot>IN SESSION</Pill>
        <span className="text-xs text-gray-500">{left === 0 ? "Last day today" : `${left} ${left === 1 ? "day" : "days"} left`}</span>
      </div>
      <p className="text-[22px] font-bold text-gray-900 mt-2">{active.name}</p>
      <p className="text-sm text-gray-500 tabular-nums">{formatDay(active.start_date)} – {formatDay(active.end_date)}</p>
      <div className="h-2 rounded-full bg-[#F1F3F1] mt-3 overflow-hidden max-w-[420px]">
        <div className="h-full rounded-full bg-[#1B5E20]" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        After {formatDay(active.end_date)}, <b className="text-gray-700">{approved}</b> approved {approved === 1 ? "pass" : "passes"} will expire automatically.
      </p>
    </div>
  );
};

// Between semesters (or nothing set up yet).
const SemesterBreak = ({ next, today, expired, currentPeriod }) => (
  <div>
    <Pill tone="gold">{next ? "SEMESTER BREAK" : "NO SEMESTER SET"}</Pill>
    {next ? (
      <>
        <p className="text-[22px] font-bold text-gray-900 mt-2">Next: {next.name}</p>
        <p className="text-sm text-gray-500">
          Starts {formatDay(next.start_date)} · in {daysBetween(today, next.start_date)} {daysBetween(today, next.start_date) === 1 ? "day" : "days"}
        </p>
        <p className="text-xs text-gray-400 mt-1">Wrong date? Use <b>Edit dates</b> below any time before it starts.</p>
      </>
    ) : (
      <>
        <p className="text-[22px] font-bold text-gray-900 mt-2">{currentPeriod || "No current semester"}</p>
        <p className="text-sm text-gray-500">Add the semester's dates so passes expire and renew on time.</p>
      </>
    )}
    {expired > 0 && (
      <p className="text-xs text-gray-500 mt-2">
        <b className="text-gray-700">{expired}</b> {expired === 1 ? "student is" : "students are"} waiting to renew when the next semester starts.
      </p>
    )}
  </div>
);

// Label above a form input.
const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[12px] font-semibold text-gray-600">{label}</span>
    {children}
  </div>
);

export default Settings;
