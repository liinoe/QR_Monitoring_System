import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { authFetch } from "../../auth";
import { colleges, programsByCollege, yearLevels } from "../../data/options";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

const toAcronym = (college) => {
  if (!college) return null;
  const key = college.trim().toLowerCase();
  return COLLEGE_ACRONYMS[key] || college.trim().toUpperCase();
};

const COLLEGE_FILTER_OPTIONS = Object.values(COLLEGE_ACRONYMS)
  .filter((v, i, arr) => arr.indexOf(v) === i); 

const emptyForm = {
  student_number: "", surname: "", first_name: "", middle_name: "",
  phone_number: "", address: "", sex: "male",
  college: "", program: "", year_level: "",
};

const ManageStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [editing, setEditing] = useState(null); 
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchStudents = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/students`);
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const splitFullName = (fullName) => {
    const parts = (fullName || "").trim().split(/\s+/);
    if (parts.length === 0) return { surname: "", first_name: "", middle_name: "" };
    if (parts.length === 1) return { surname: parts[0], first_name: "", middle_name: "" };
    const surname = parts[parts.length - 1];
    const first_name = parts[0];
    const middle_name = parts.slice(1, -1).join(" ");
    return { surname, first_name, middle_name };
  };

  const openEdit = (student) => {
    setEditing(student.student_number);
    const hasStructuredName = student.surname || student.first_name;
    const guessed = hasStructuredName ? null : splitFullName(student.full_name);
    setForm({
      student_number: student.student_number,
      surname: student.surname || guessed?.surname || "",
      first_name: student.first_name || guessed?.first_name || "",
      middle_name: student.middle_name || guessed?.middle_name || "",
      phone_number: student.phone_number || "",
      address: student.address || "",
      sex: student.sex || "male",
      college: student.college || "",
      program: student.program || "",
      year_level: student.year_level || "",
    });
    setError("");
  };

  const closeEdit = () => { setEditing(null); setForm(emptyForm); setError(""); };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Same behavior as RegisterScreen.jsx's updateCollege(): changing the
  // college clears whatever program was selected, since the old program
  // may not exist under the new college.
  const handleCollegeChange = (e) => {
    setForm((f) => ({ ...f, college: e.target.value, program: "" }));
  };

  const availablePrograms = form.college ? (programsByCollege[form.college] || []) : [];

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { student_number, ...payload } = form;
      const res = await authFetch(`${API_URL}/api/admin/students/${student_number}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to update student.");
        return;
      }
      closeEdit();
      fetchStudents();
    } catch (err) {
      console.error(err);
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (s.full_name || "").toLowerCase().includes(term) ||
      (s.student_number || "").includes(searchTerm);
    const matchesCollege =
      collegeFilter === "All Colleges" || toAcronym(s.college) === collegeFilter;
    return matchesSearch && matchesCollege;
  });

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] pb-[40px] space-y-[20px]">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Student Accounts</h1>
            <p className="text-[#666]">
              Update a student's college, program, year level, or contact info — e.g. after a program shift.
            </p>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search students..."
              className="pl-4 pr-4 py-2 border rounded-lg w-[280px] bg-white outline-none focus:ring-1 focus:ring-green-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="border px-4 py-2 rounded-lg bg-white text-gray-600"
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
            >
              <option>All Colleges</option>
              {COLLEGE_FILTER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-[10px] border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-[#FAFAFA]">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Student No.</th>
                  <th className="py-3 px-4">College</th>
                  <th className="py-3 px-4">Program</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">No students match your filters.</td></tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.student_number} className="border-b last:border-0">
                      <td className="py-3 px-4">{s.full_name}</td>
                      <td className="py-3 px-4">{s.student_number}</td>
                      <td className="py-3 px-4">{toAcronym(s.college) || s.college}</td>
                      <td className="py-3 px-4">{s.program}</td>
                      <td className="py-3 px-4">{s.year_level}</td>
                      <td className="py-3 px-4 capitalize">{s.status}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-[#1B651B] font-medium hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] p-6 w-[520px] max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Edit Student — {form.student_number}</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <input name="surname" placeholder="Surname" value={form.surname} onChange={handleChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
                <input name="first_name" placeholder="First Name" value={form.first_name} onChange={handleChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
                <input name="middle_name" placeholder="Middle Name" value={form.middle_name} onChange={handleChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input name="phone_number" placeholder="Phone Number" value={form.phone_number} onChange={handleChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <select name="sex" value={form.sex} onChange={handleChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <input name="address" placeholder="Address" value={form.address} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />

              <div className="grid grid-cols-3 gap-3">
                <select name="college" value={form.college} onChange={handleCollegeChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
                  <option value="" disabled>Select college</option>
                  {colleges.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                  name="program"
                  value={form.program}
                  onChange={handleChange}
                  disabled={!form.college}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                  required
                >
                  <option value="" disabled>
                    {form.college ? "Select program" : "Select a college first"}
                  </option>
                  {availablePrograms.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>

                <select name="year_level" value={form.year_level} onChange={handleChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
                  <option value="" disabled>Year Level</option>
                  {yearLevels.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="bg-[#1B651B] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#165516] disabled:opacity-60">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={closeEdit}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStudents;