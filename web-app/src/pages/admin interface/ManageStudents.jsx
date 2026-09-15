import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import Pagination from "../../components/Pagination";
import { authFetch } from "../../auth";
import { colleges, programsByCollege, yearLevels } from "../../data/options";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
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

  const filtered = students
    .filter((s) => s.status === "approved")
    .filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (s.full_name || "").toLowerCase().includes(term) ||
      (s.student_number || "").includes(searchTerm);
    const matchesCollege =
      collegeFilter === "All Colleges" || toAcronym(s.college) === collegeFilter;
    return matchesSearch && matchesCollege;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, collegeFilter, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

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

          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FilterSelect value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
              <option value="All Colleges">All Colleges</option>
              {COLLEGE_FILTER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </FilterSelect>
          </div>

          {/* NEW STRUCTURE: Main wrapper for styling, inner wrapper for scrolling */}
          <div className="bg-white rounded-[10px] border shadow-sm">
            <div className="overflow-x-auto rounded-t-[10px] overflow-hidden">
              <table className="responsive-table w-full text-sm">
                <thead className="bg-[#F3FAF3] text-[#1B651B] border-b">
                  <tr>
                    <th className="p-4 text-left font-semibold">Student No.</th>
                    <th className="p-4 text-left font-semibold">Name</th>
                    <th className="p-4 text-left font-semibold">College</th>
                    <th className="p-4 text-left font-semibold">Program</th>
                    <th className="p-4 text-left font-semibold">Year</th>
                    <th className="p-4 text-left font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400">No students match your filters.</td></tr>
                  ) : (
                    paginated.map((s) => (
                      <tr key={s.student_number} className="border-b last:border-0">
                        <td className="p-4 font-medium text-gray-900">{s.student_number}</td>
                        <td className="p-4">{s.full_name}</td>
                        <td className="p-4">{toAcronym(s.college) || s.college}</td>
                        <td className="p-4">{s.program}</td>
                        <td className="p-4">{s.year_level}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => openEdit(s)}
                            className="inline-flex items-center gap-1 bg-[#1B651B] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:bg-[#165516] active:scale-[0.98] transition"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination is now OUTSIDE the overflow-x-auto div */}
            {!loading && filtered.length > 0 && (
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={setRowsPerPage}
                rowsPerPageOptions={[10, 20]}
                totalItems={filtered.length}
                itemLabel="students"
              />
            )}
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

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-3 gap-3 student-edit-name-fields">
                <div className="flex flex-col gap-1">
                  <label htmlFor="surname" className="text-xs font-medium text-gray-600">Surname</label>
                  <input id="surname" name="surname" placeholder="Surname" value={form.surname} onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="first_name" className="text-xs font-medium text-gray-600">First Name</label>
                  <input id="first_name" name="first_name" placeholder="First Name" value={form.first_name} onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="middle_name" className="text-xs font-medium text-gray-600">Middle Name</label>
                  <input id="middle_name" name="middle_name" placeholder="Middle Name" value={form.middle_name} onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="phone_number" className="text-xs font-medium text-gray-600">Phone Number</label>
                  <input id="phone_number" name="phone_number" placeholder="Phone Number" value={form.phone_number} onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="sex" className="text-xs font-medium text-gray-600">Sex</label>
                  <select id="sex" name="sex" value={form.sex} onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="address" className="text-xs font-medium text-gray-600">Address</label>
                <input id="address" name="address" placeholder="Address" value={form.address} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-3 gap-3 student-edit-academic-fields">
                <div className="flex flex-col gap-1">
                  <label htmlFor="college" className="text-xs font-medium text-gray-600">College</label>
                  <select id="college" name="college" value={form.college} onChange={handleCollegeChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
                    <option value="" disabled>Select college</option>
                    {colleges.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="program" className="text-xs font-medium text-gray-600">Program</label>
                  <select
                    id="program"
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
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="year_level" className="text-xs font-medium text-gray-600">Year Level</label>
                  <select id="year_level" name="year_level" value={form.year_level} onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
                    <option value="" disabled>Select year level</option>
                    {yearLevels.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
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