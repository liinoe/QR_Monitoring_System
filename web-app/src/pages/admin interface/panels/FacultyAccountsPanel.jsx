import React, { useEffect, useState } from "react";
import SearchInput from "../../../components/SearchInput";
import FilterSelect from "../../../components/FilterSelect";
import Pagination from "../../../components/Pagination";
import { authFetch } from "../../../auth";
import useChangeWatcher from "../../../components/useChangeWatcher";
import { colleges, toCollegeAcronym } from "../../../data/options";
import { BRAND, COLLEGE_COLORS, PageTitle, Pill, Avatar, Dialog, btn } from "../../../components/AdminUI";
import {
  CollegeLabel, FormSection, PhoneInput, Field, inputClass,
  isValidPhone, normalizePhoneDigits, displayNameOf, surnameOf,
} from "./StudentAccountsPanel";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const COLLEGE_FILTER_OPTIONS = Object.keys(COLLEGE_COLORS);

const emptyForm = { employee_id: "", surname: "", first_name: "", middle_name: "", phone_number: "", address: "", sex: "male", college: "" };

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "surname_az", label: "Surname (A–Z)" },
  { value: "surname_za", label: "Surname (Z–A)" },
  { value: "number", label: "Employee ID (ascending)" },
];

// Admin page for correcting an approved FACULTY member's details (name, contact, college).
// The Employee ID and email can't be edited here; accounts are ended with Deactivate on the Registrations page.
const FacultyAccountsPanel = ({ switcher }) => {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [sortBy, setSortBy] = useState("newest");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFor, setSavedFor] = useState(null);
  const [phoneCheck, setPhoneCheck] = useState({ state: "idle", message: "" });

  // Live "is this phone number already used?" check (skips the member's own current number).
  useEffect(() => {
    if (!editing || !isValidPhone(form.phone_number) || form.phone_number === editing.phone_number) {
      setPhoneCheck({ state: "idle", message: "" });
      return undefined;
    }
    setPhoneCheck({ state: "checking", message: "Checking..." });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const url = `${API_URL}/api/faculty/register/check-phone/${encodeURIComponent(form.phone_number)}?employee_id=${encodeURIComponent(form.employee_id)}`;
        const data = await (await fetch(url)).json();
        if (cancelled) return;
        setPhoneCheck(data.available
          ? { state: "available", message: data.message || "Phone number is available." }
          : { state: "taken", message: data.message || "This phone number is already used by another account." });
      } catch {
        if (!cancelled) setPhoneCheck({ state: "unknown", message: "Could not check right now." });
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.phone_number, form.employee_id, editing]);

  const fetchFaculty = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/faculty`);
      const data = await res.json();
      setFaculty(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load faculty:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchFaculty(); }, []);
  useChangeWatcher(["students", "registrations"], fetchFaculty);

  const openEdit = (person) => {
    setEditing(person);
    setForm({
      employee_id: person.employee_id,
      surname: person.surname || "",
      first_name: person.first_name || "",
      middle_name: person.middle_name || "",
      phone_number: isValidPhone(person.phone_number)
        ? person.phone_number
        : person.phone_number ? `+63${normalizePhoneDigits(person.phone_number)}` : "",
      address: person.address || "",
      sex: person.sex || "male",
      college: person.college || "",
    });
    setError("");
  };
  const closeEdit = () => { setEditing(null); setForm(emptyForm); setError(""); };
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.college) { setError("Please choose the college."); return; }
    const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/;
    if ([form.surname, form.first_name, form.middle_name].some((n) => n.trim() && !NAME_REGEX.test(n.trim()))) {
      setError("Names can only contain letters, spaces, hyphens, apostrophes and periods.");
      return;
    }
    if (!isValidPhone(form.phone_number)) { setError("Please enter all 10 digits of the phone number after +63."); return; }
    if (phoneCheck.state === "taken") { setError("This phone number is already used by another account."); return; }
    setSaving(true);
    setError("");
    try {
      const { employee_id, ...payload } = form;
      const res = await authFetch(`${API_URL}/api/admin/faculty/${employee_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to update faculty."); return; }
      closeEdit();
      setSavedFor(employee_id);
      fetchFaculty();
    } catch (err) {
      console.error(err);
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const approved = faculty.filter((f) => f.status === "approved");
  const filtered = approved.filter((f) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (f.full_name || "").toLowerCase().includes(term) || (f.employee_id || "").includes(searchTerm);
    const matchesCollege = collegeFilter === "All Colleges" || toCollegeAcronym(f.college) === collegeFilter;
    return matchesSearch && matchesCollege;
  });
  filtered.sort((a, b) => {
    if (sortBy === "newest") return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === "number") return (a.employee_id || "").localeCompare(b.employee_id || "", undefined, { numeric: true });
    const byName = surnameOf(a).localeCompare(surnameOf(b)) || (a.first_name || "").toLowerCase().localeCompare((b.first_name || "").toLowerCase());
    return sortBy === "surname_za" ? -byName : byName;
  });
  useEffect(() => { setCurrentPage(1); }, [searchTerm, collegeFilter, sortBy, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  return (
    <>
      <PageTitle
        title="Faculty Accounts"
        subtitle="Update a faculty member's college or contact info. To end an account, use Deactivate on the Registrations page."
        right={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {!loading && <Pill tone="green">{approved.length} approved faculty</Pill>}
            {switcher}
          </div>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput placeholder="Search by name or employee ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <FilterSelect value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
          <option value="All Colleges">All Colleges</option>
          {COLLEGE_FILTER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </FilterSelect>
        <FilterSelect value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{`Sort: ${o.label}`}</option>)}
        </FilterSelect>
      </div>

      <div className="bg-white rounded-[12px] border border-[#ECEFEC]">
        <div className="overflow-x-auto rounded-t-[20px]">
          <table className="responsive-table w-full text-sm">
            <thead>
              <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] border-b border-[#F1F3F1]">
                <th className="px-5 py-4 text-left">Employee ID</th>
                <th className="px-5 py-4 text-left">Name</th>
                <th className="px-5 py-4 text-left">College</th>
                <th className="px-5 py-4 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F1]">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400">No faculty match your filters.</td></tr>
              ) : (
                paginated.map((f) => (
                  <tr key={f.employee_id} className="hover:bg-[#F7F8F7] transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">{f.employee_id}</td>
                    <td className="px-5 py-3.5 max-w-[260px]">
                      <p className="font-semibold text-gray-900 truncate">{displayNameOf(f)}</p>
                      {f.email && <p className="text-xs text-gray-500 mt-0.5 truncate">{f.email}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{toCollegeAcronym(f.college) || "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => openEdit(f)} className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F1E9] text-[#1B5E20] px-4 py-2 text-xs font-bold hover:bg-[#dbe9dc] transition-colors">
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
            itemLabel="faculty"
          />
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A0F]/40 backdrop-blur-sm" onClick={closeEdit}>
          <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-white rounded-[12px] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-4 flex items-center gap-4">
              <Avatar name={displayNameOf(editing)} />
              <div className="min-w-0">
                <p className="text-[18px] font-bold text-gray-900 leading-tight tabular-nums">{form.employee_id}</p>
                <p className="text-sm text-gray-500 mt-0.5 truncate">Editing {displayNameOf(editing)}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="px-7 pb-7 space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-[8px] bg-[#FBDFDB] text-[#B3261E] text-sm font-semibold px-4 py-2.5">{error}</div>
              )}

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
                    <PhoneInput value={form.phone_number} onChange={(v) => setForm((f) => ({ ...f, phone_number: v }))} check={phoneCheck} />
                  </Field>
                  <Field label="Sex" htmlFor="sex">
                    <FilterSelect fullWidth value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </FilterSelect>
                  </Field>
                </div>
                <Field label="Address" htmlFor="address">
                  <input id="address" name="address" value={form.address} onChange={handleChange} className={inputClass} />
                </Field>
              </FormSection>

              <FormSection title="Employment information">
                <Field label="College" htmlFor="college">
                  <FilterSelect fullWidth placeholder="Select college" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })}>
                    {colleges.map((c) => <option key={c} value={c}><CollegeLabel college={c} /></option>)}
                  </FilterSelect>
                </Field>
              </FormSection>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeEdit} className={`${btn.secondary} flex-1`}>Cancel</button>
                <button type="submit" disabled={saving} className={`${btn.primary} flex-1`}>{saving ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Dialog
        open={!!savedFor}
        tone="success"
        title="Changes Saved"
        message={`Employee ${savedFor}'s details were updated.`}
        footer={<button onClick={() => setSavedFor(null)} className={btn.primary}>OK</button>}
      />
    </>
  );
};

export default FacultyAccountsPanel;