import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { authFetch, isSuperAdmin } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Settings = () => {
  const superAdmin = isSuperAdmin();
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [semesterStatus, setSemesterStatus] = useState(null);
  const [showSemesterForm, setShowSemesterForm] = useState(false);
  const [newPeriod, setNewPeriod] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [startingNewSemester, setStartingNewSemester] = useState(false);

  const loadSemesterStatus = async () => {
    if (!superAdmin) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/semester-status`);
      if (res.ok) setSemesterStatus(await res.json());
    } catch (err) {
      console.error("Failed to load semester status:", err);
    }
  };

  const loadStaff = async () => {
    if (!superAdmin) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/staff`);
      if (res.ok) setStaff(await res.json());
    } catch (err) {
      console.error("Failed to load staff:", err);
    }
  };

  useEffect(() => {
    loadStaff();
    loadSemesterStatus();
  }, []);

  const handleSemesterSelectChange = (e) => {
    const value = e.target.value;
    if (value === "__custom__") {
      setIsCustom(true);
      setNewPeriod("");
    } else {
      setIsCustom(false);
      setNewPeriod(value);
    }
  };

  const handleStartNewSemester = async () => {
    if (!newPeriod.trim()) {
      alert("Please select or enter a name for the new academic period.");
      return;
    }
    const affected = semesterStatus?.approved_student_count ?? 0;
    const confirmed = window.confirm(
      `Start "${newPeriod.trim()}"? This will flip ${affected} currently-approved student(s) back to Pending and revoke their QR passes. They'll need to renew and be re-approved. This cannot be undone.`
    );
    if (!confirmed) return;

    setStartingNewSemester(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/start-new-semester`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_period: newPeriod.trim(), is_custom: isCustom }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to start new semester.");
        return;
      }
      alert(data.message);
      setNewPeriod("");
      setIsCustom(false);
      setShowSemesterForm(false);
      loadSemesterStatus();
    } catch (err) {
      console.error(err);
      alert("Could not reach the server.");
    } finally {
      setStartingNewSemester(false);
    }
  };

  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/create`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to create account.");
        return;
      }
      setForm({ name: "", email: "", password: "", role: "admin" });
      setShowForm(false);
      loadStaff();
    } catch (err) {
      console.error(err);
      setError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] pb-[40px] space-y-[20px]">
          <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>

          {/* ACADEMIC PERIOD SECTION — super admin only */}
          {superAdmin && (
            <div className="bg-white p-6 rounded-[10px] border shadow-sm">
              <h2 className="text-lg font-semibold text-gray-700">Academic Period</h2>
              <p className="text-sm text-gray-500 mb-4">
                Controls semester-based registration renewal. Starting a new period
                requires every currently-approved student to renew and be re-approved.
              </p>

              <div className="bg-[#F3FAF3] border border-green-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-gray-500">Current Period</p>
                <p className="text-lg font-bold text-[#1B651B]">
                  {semesterStatus?.current_period || "Loading..."}
                </p>
                {semesterStatus && (
                  <p className="text-xs text-gray-500 mt-1">
                    {semesterStatus.approved_student_count} student(s) currently approved
                  </p>
                )}
              </div>

              {!showSemesterForm ? (
                <button
                  onClick={() => setShowSemesterForm(true)}
                  className="bg-[#B45309] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#92400E] transition-colors"
                >
                  Start New Semester
                </button>
              ) : (
                <div className="border rounded-lg p-4 bg-[#FFFBEB] space-y-3">
                  <p className="text-sm text-amber-800 font-medium">
                    ⚠ This will reset {semesterStatus?.approved_student_count ?? 0} approved student(s) to Pending and revoke their QR passes.
                  </p>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Next academic period</label>
                    <select
                      value={isCustom ? "__custom__" : newPeriod}
                      onChange={handleSemesterSelectChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="" disabled>
                        {semesterStatus?.next_period_options?.length
                          ? "Select next period"
                          : "No suggestions available — use Custom"}
                      </option>
                      {(semesterStatus?.next_period_options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="__custom__">Custom...</option>
                    </select>
                  </div>

                  {isCustom && (
                    <input
                      type="text"
                      placeholder="e.g. 2nd Semester A.Y. 2025-2026"
                      value={newPeriod}
                      onChange={(e) => setNewPeriod(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleStartNewSemester}
                      disabled={startingNewSemester}
                      className="bg-[#B45309] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#92400E] transition-colors disabled:opacity-60"
                    >
                      {startingNewSemester ? "Starting..." : "Confirm & Start"}
                    </button>
                    <button
                      onClick={() => { setShowSemesterForm(false); setNewPeriod(""); setIsCustom(false); }}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAFF ACCOUNTS SECTION — super admin only */}
          {superAdmin && (
            <div className="bg-white p-6 rounded-[10px] border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-700">Manage Staff Accounts</h2>
                  <p className="text-sm text-gray-500">Create and view admin/staff accounts.</p>
                </div>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="bg-[#1B651B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#165516] transition-colors"
                >
                  {showForm ? "Cancel" : "+ New Account"}
                </button>
              </div>

              {showForm && (
                <form onSubmit={handleCreateStaff} className="border rounded-lg p-4 mb-4 space-y-3 bg-[#FAFAFA]">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                      {error}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      name="name" placeholder="Full Name" required
                      value={form.name} onChange={handleFormChange}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      name="email" type="email" placeholder="Email" required
                      value={form.email} onChange={handleFormChange}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="relative">
                      <input
                        name="password" type={showPassword ? "text" : "password"} placeholder="Password" required
                        value={form.password} onChange={handleFormChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-14 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B651B] hover:underline"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <select
                      name="role" value={form.role} onChange={handleFormChange}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="admin">Admin / Library Staff</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <button
                    type="submit" disabled={creating}
                    className="bg-[#1B651B] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#165516] transition-colors disabled:opacity-60"
                  >
                    {creating ? "Creating..." : "Create Account"}
                  </button>
                </form>
              )}

              <div className="responsive-table-container">
              <table className="responsive-table settings-staff-table w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.admin_id} className="border-b last:border-0">
                      <td className="py-2">{s.name}</td>
                      <td className="py-2">{s.email}</td>
                      <td className="py-2 capitalize">{s.role.replace('_', ' ')}</td>
                      <td className="py-2">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;