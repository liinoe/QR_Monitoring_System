import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import Pagination from "../../components/Pagination";
import { authFetch } from "../../auth";
import { colleges, programsByCollege, yearLevels, toCollegeAcronym } from "../../data/options";
import { BRAND, COLLEGE_COLORS, PageTitle, Pill, Avatar, Dialog, btn } from "../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// College codes for the filter dropdown, A–Z.
const COLLEGE_FILTER_OPTIONS = Object.keys(COLLEGE_COLORS);

// Blank edit form.
const emptyForm = {
  student_number: "", surname: "", first_name: "", middle_name: "",
  phone_number: "", address: "", sex: "male",
  college: "", program: "", year_level: "",
};

// College choice label: bold code + gray name, e.g. "CEIT · Engineering and Information Technology".
const CollegeLabel = ({ college }) => (
  <>
    <span className="font-bold">{toCollegeAcronym(college)}</span>
    <span className="text-gray-400 font-normal"> · {college.replace(/^College of /i, "")}</span>
  </>
);

// Same input look as the guest kiosk / mobile app.
const inputClass =
  "w-full bg-white border border-[#E3E7E3] rounded-[12px] px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition focus:border-[#1B5E20] focus:ring-4 focus:ring-[#1B5E20]/10 disabled:bg-[#F4F5F4] disabled:text-gray-400";

// Phone helpers (same rules as the mobile Register screen).
// Keeps only the 10 digits after +63 (accepts "09...", "63..." or "9...").
const normalizePhoneDigits = (value) => {
  const digits = (value || "").replace(/\D/g, "");
  const local = digits.startsWith("09") ? digits.slice(1) : digits.startsWith("63") ? digits.slice(2) : digits;
  return local.slice(0, 10);
};
// Shows "+639123456789" as "912 345 6789" in the input box.
const formatPhoneDigits = (phone) => {
  const d = (phone || "").replace(/^\+63/, "").slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(" ");
};
// A complete Philippine mobile number: +63 then 9 and 9 more digits.
const isValidPhone = (phone) => /^\+639\d{9}$/.test(phone || "");

// Year levels for a college: Vet Med (CVMBS) also has a 6th year.
const yearLevelsFor = (college) =>
  /veterinary/i.test(college || "") ? [...yearLevels.filter((y) => y !== "6th Year"), "6th Year"] : yearLevels;

// "Juan D. Dela Cruz" style name (falls back to full_name for old records).
const displayNameOf = (s) =>
  s.first_name && s.surname
    ? `${s.first_name} ${s.middle_name ? s.middle_name.charAt(0).toUpperCase() + ". " : ""}${s.surname}`
    : s.full_name || "—";

// Admin page for correcting an approved student's details (e.g. after a program shift).
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
  // Student number shown in the "Changes saved" pop-up.
  const [savedFor, setSavedFor] = useState(null);
  // Live phone check: idle | checking | available | taken | unknown
  const [phoneCheck, setPhoneCheck] = useState({ state: "idle", message: "" });

  // Live "is this phone number already used?" check, like the mobile app.
  // Waits 0.5 s after the admin stops typing. Skips the student's own current number.
  useEffect(() => {
    if (!editing || !isValidPhone(form.phone_number) || form.phone_number === editing.phone_number) {
      setPhoneCheck({ state: "idle", message: "" });
      return;
    }
    setPhoneCheck({ state: "checking", message: "Checking..." });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const url = `${API_URL}/api/register/check-phone/${encodeURIComponent(form.phone_number)}?student_number=${encodeURIComponent(form.student_number)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        setPhoneCheck(data.available
          ? { state: "available", message: data.message || "Phone number is available." }
          : { state: "taken", message: data.message || "This phone number is already used by another account." });
      } catch {
        if (!cancelled) setPhoneCheck({ state: "unknown", message: "Could not check right now." });
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.phone_number, form.student_number, editing]);

  // Gets every student account from the server.
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

  // Load the list once when the page opens.
  useEffect(() => { fetchStudents(); }, []);

  // Old records only have full_name: guess surname / first / middle from it.
  const splitFullName = (fullName) => {
    const parts = (fullName || "").trim().split(/\s+/);
    if (parts.length === 0) return { surname: "", first_name: "", middle_name: "" };
    if (parts.length === 1) return { surname: parts[0], first_name: "", middle_name: "" };
    return {
      surname: parts[parts.length - 1],
      first_name: parts[0],
      middle_name: parts.slice(1, -1).join(" "),
    };
  };

  // "Edit": fills the form with the student's current details and opens the pop-up.
  const openEdit = (student) => {
    setEditing(student);
    const hasStructuredName = student.surname || student.first_name;
    const guessed = hasStructuredName ? null : splitFullName(student.full_name);
    setForm({
      student_number: student.student_number,
      surname: student.surname || guessed?.surname || "",
      first_name: student.first_name || guessed?.first_name || "",
      middle_name: student.middle_name || guessed?.middle_name || "",
      // Old records may be saved as "09..."; show them in the +63 format.
      phone_number: isValidPhone(student.phone_number)
        ? student.phone_number
        : student.phone_number ? `+63${normalizePhoneDigits(student.phone_number)}` : "",
      address: student.address || "",
      sex: student.sex || "male",
      college: student.college || "",
      program: student.program || "",
      year_level: student.year_level || "",
    });
    setError("");
  };

  // Closes the edit pop-up and clears the form.
  const closeEdit = () => { setEditing(null); setForm(emptyForm); setError(""); };

  // Updates one form field as the admin types.
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Changing the college clears the program (programs belong to a college),
  // and clears "6th Year" if the new college doesn't have it.
  const handleCollegeChange = (e) => {
    const college = e.target.value;
    setForm((f) => ({
      ...f,
      college,
      program: "",
      year_level: yearLevelsFor(college).includes(f.year_level) ? f.year_level : "",
    }));
  };

  const availablePrograms = form.college ? programsByCollege[form.college] || [] : [];

  // "Save Changes": checks the dropdowns, then sends the edited details to the server.
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.college || !form.program || !form.year_level) {
      setError("Please choose the college, program and year level.");
      return;
    }
    // Names: letters, spaces, hyphens, apostrophes and periods only (same rule as the mobile app).
    const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/;
    const badName = [form.surname, form.first_name, form.middle_name].some((n) => n.trim() && !NAME_REGEX.test(n.trim()));
    if (badName) {
      setError("Names can only contain letters, spaces, hyphens, apostrophes and periods.");
      return;
    }
    if (!isValidPhone(form.phone_number)) {
      setError("Please enter all 10 digits of the phone number after +63.");
      return;
    }
    if (phoneCheck.state === "taken") {
      setError("This phone number is already used by another account.");
      return;
    }
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
      setSavedFor(student_number);
      fetchStudents();
    } catch (err) {
      console.error(err);
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  // Approved students that match the search box and college filter.
  const approved = students.filter((s) => s.status === "approved");
  const filtered = approved.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (s.full_name || "").toLowerCase().includes(term) || (s.student_number || "").includes(searchTerm);
    const matchesCollege = collegeFilter === "All Colleges" || toCollegeAcronym(s.college) === collegeFilter;
    return matchesSearch && matchesCollege;
  });

  // Go back to page 1 whenever a filter changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, collegeFilter, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          <PageTitle
            title="Student Accounts"
            subtitle="Update a student's college, program, year level, or contact info — e.g. after a program shift."
            right={!loading && <Pill tone="green">{approved.length} approved {approved.length === 1 ? "student" : "students"}</Pill>}
          />

          {/* SEARCH AND FILTER */}
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search by name or student no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FilterSelect value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
              <option value="All Colleges">All Colleges</option>
              {COLLEGE_FILTER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </FilterSelect>
          </div>

          {/* TABLE (no overflow-hidden on the outer box, so dropdowns aren't cut off) */}
          <div className="bg-white rounded-[20px] border border-[#ECEFEC]">
            <div className="overflow-x-auto rounded-t-[20px]">
              <table className="responsive-table w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] border-b border-[#F1F3F1]">
                    <th className="px-5 py-4 text-left">Student No.</th>
                    <th className="px-5 py-4 text-left">Name</th>
                    <th className="px-5 py-4 text-left">Program / College</th>
                    <th className="px-5 py-4 text-left">Year</th>
                    <th className="px-5 py-4 text-left"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F3F1]">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">No students match your filters.</td></tr>
                  ) : (
                    paginated.map((s) => (
                      <tr key={s.student_number} className="hover:bg-[#F7F8F7] transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">{s.student_number}</td>
                        {/* Name in bold, email in gray */}
                        <td className="px-5 py-3.5 max-w-[240px]">
                          <p className="font-semibold text-gray-900 truncate">{displayNameOf(s)}</p>
                          {s.email && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.email}</p>}
                        </td>
                        {/* Program in bold, college in gray */}
                        <td className="px-5 py-3.5 max-w-[300px]">
                          <p className="font-semibold text-gray-900 truncate">{s.program || "—"}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{toCollegeAcronym(s.college) || "—"}</p>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{s.year_level || "—"}</td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => openEdit(s)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F1E9] text-[#1B5E20] px-4 py-2 text-xs font-bold hover:bg-[#dbe9dc] transition-colors"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
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
        </main>
      </div>

      {/* EDIT POP-UP */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A0F]/40 backdrop-blur-sm" onClick={closeEdit}>
          <div
            className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-white rounded-[24px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: student number in bold, name in gray */}
            <div className="px-7 pt-7 pb-4 flex items-center gap-4">
              <Avatar name={displayNameOf(editing)} />
              <div className="min-w-0">
                <p className="text-[18px] font-bold text-gray-900 leading-tight tabular-nums">{form.student_number}</p>
                <p className="text-sm text-gray-500 mt-0.5 truncate">Editing {displayNameOf(editing)}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="px-7 pb-7 space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-[12px] bg-[#FBDFDB] text-[#B3261E] text-sm font-semibold px-4 py-2.5">
                  {error}
                </div>
              )}

              {/* Personal info */}
              <FormSection title="Personal information">
                <div className="grid grid-cols-3 gap-3 student-edit-name-fields">
                  <Field label="Surname" htmlFor="surname">
                    <input id="surname" name="surname" value={form.surname} onChange={handleChange} className={inputClass} required />
                  </Field>
                  <Field label="First Name" htmlFor="first_name">
                    <input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} className={inputClass} required />
                  </Field>
                  <Field label="Middle Name" htmlFor="middle_name">
                    <input id="middle_name" name="middle_name" value={form.middle_name} onChange={handleChange} className={inputClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone Number" htmlFor="phone_number">
                    <PhoneInput
                      value={form.phone_number}
                      onChange={(v) => setForm((f) => ({ ...f, phone_number: v }))}
                      check={phoneCheck}
                    />
                  </Field>
                  <Field label="Sex" htmlFor="sex">
                    <FilterSelect fullWidth value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </FilterSelect>
                  </Field>
                </div>
                <Field label="Address" htmlFor="address">
                  <input id="address" name="address" value={form.address} onChange={handleChange} className={inputClass} />
                </Field>
              </FormSection>

              {/* Academic info */}
              <FormSection title="Academic information">
                <Field label="College" htmlFor="college">
                  <FilterSelect fullWidth placeholder="Select college" value={form.college} onChange={handleCollegeChange}>
                    {colleges.map((c) => (
                      <option key={c} value={c}><CollegeLabel college={c} /></option>
                    ))}
                  </FilterSelect>
                </Field>
                <div className="grid grid-cols-3 gap-3 student-edit-academic-fields">
                  <div className="col-span-2">
                    <Field label="Program" htmlFor="program">
                      <FilterSelect
                        fullWidth
                        disabled={!form.college}
                        placeholder={form.college ? "Select program" : "Select a college first"}
                        value={form.program}
                        onChange={(e) => setForm({ ...form, program: e.target.value })}
                      >
                        {availablePrograms.map((p) => <option key={p} value={p}>{p}</option>)}
                      </FilterSelect>
                    </Field>
                  </div>
                  <Field label="Year Level" htmlFor="year_level">
                    <FilterSelect fullWidth placeholder="Select year" value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })}>
                      {yearLevelsFor(form.college).map((y) => <option key={y} value={y}>{y}</option>)}
                    </FilterSelect>
                  </Field>
                </div>
              </FormSection>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeEdit} className={`${btn.secondary} flex-1`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`${btn.primary} flex-1`}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* "Changes saved" pop-up */}
      <Dialog
        open={!!savedFor}
        tone="success"
        title="Changes Saved"
        message={`Student ${savedFor}'s details were updated.`}
        footer={<button onClick={() => setSavedFor(null)} className={btn.primary}>OK</button>}
      />
    </div>
  );
};

// Small uppercase heading with its fields in a light gray box.
const FormSection = ({ title, children }) => (
  <div>
    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.08em] mb-2 ml-1">{title}</p>
    <div className="rounded-[16px] bg-[#F7F8F7] p-4 space-y-3">{children}</div>
  </div>
);

// Phone input with a fixed "+63" in front: digits only, max 10 digits.
// Red border while incomplete or already used; live message underneath.
const PhoneInput = ({ value, onChange, check }) => {
  const digits = (value || "").replace(/^\+63/, "");
  const invalid = (digits.length > 0 && !/^9\d{9}$/.test(digits)) || check.state === "taken";
  const tone = {
    checking: "text-gray-500",
    available: "text-[#1B5E20]",
    taken: "text-[#B3261E]",
    unknown: "text-[#946800]",
  }[check.state];
  return (
    <div>
      <div
        className={`flex items-center bg-white border rounded-[12px] transition focus-within:ring-4 ${
          invalid
            ? "border-[#B3261E] focus-within:ring-[#B3261E]/10"
            : "border-[#E3E7E3] focus-within:border-[#1B5E20] focus-within:ring-[#1B5E20]/10"
        }`}
      >
        <span className="pl-3.5 pr-2 text-sm font-semibold text-gray-600 border-r border-[#E3E7E3]">+63</span>
        <input
          id="phone_number"
          inputMode="numeric"
          autoComplete="off"
          value={formatPhoneDigits(value)}
          onChange={(e) => onChange(`+63${normalizePhoneDigits(e.target.value)}`)}
          placeholder="912 345 6789"
          maxLength={12}
          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none tabular-nums"
        />
      </div>
      {digits.length > 0 && !/^9\d{9}$/.test(digits) ? (
        <p className="text-[12px] mt-1 text-[#B3261E]">Enter all 10 digits after +63 (starts with 9).</p>
      ) : check.state !== "idle" ? (
        <p className={`text-[12px] mt-1 ${tone}`}>{check.message}</p>
      ) : null}
    </div>
  );
};

// Label above an input.
const Field = ({ label, htmlFor, children }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="text-[12px] font-semibold text-gray-600">{label}</label>
    {children}
  </div>
);

export default ManageStudents;
