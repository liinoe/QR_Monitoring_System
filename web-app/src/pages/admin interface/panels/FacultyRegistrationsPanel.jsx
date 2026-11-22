import React, { useEffect, useMemo, useState } from "react";
import SearchInput from "../../../components/SearchInput";
import FilterSelect from "../../../components/FilterSelect";
import FilterTabs from "../../../components/FilterTabs";
import Pagination from "../../../components/Pagination";
import ReasonModal from "../../../components/ReasonModal";
import { authFetch } from "../../../auth";
import useChangeWatcher from "../../../components/useChangeWatcher";
import FacultyDetailsModal from "../../../components/FacultyDetailsModal";
import FacultyRegistrationItem from "../../../components/FacultyRegistrationItem";
import { collegeAcronyms, toCollegeAcronym } from "../../../data/options";
import { BRAND, PageTitle, KpiCard, Pill, Dialog, btn } from "../../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const COLLEGE_FILTER_OPTIONS = Object.values(collegeAcronyms);

// Faculty have no semesters or renewals, so the tabs are only the account states.
const STATUS_TABS = ["All", "Pending", "Approved", "Rejected", "Deactivated"];

// Reasons for rejecting a faculty registration. The text is shown to the faculty member
// in the mobile app (see getRejectionGuide in the app's rejection.js), so keep them short.
const REJECT_REASONS = [
  "Employee ID is unclear or incorrect", // blurry, cut off, expired, or not theirs
  "Information does not match",
  "Not currently employed",
  "Other (specify below)",
];

// Reasons for deactivating an approved faculty account.
const DEACTIVATE_REASONS = [
  "Lost or compromised QR pass",
  "Resigned / no longer employed",
  "Retired",
  "Disciplinary action",
  "Other (specify below)",
];

// "Juan D. Dela Cruz" style name.
const displayNameOf = (r) =>
  r.first_name && r.surname
    ? `${r.first_name} ${r.middle_name ? r.middle_name.charAt(0).toUpperCase() + ". " : ""}${r.surname}`
    : r.full_name || "—";

// Admin view of FACULTY registrations: review the employee ID, approve, reject, deactivate, reactivate.
// There is no semester or renewal for faculty: an approved pass works until it is deactivated.
const FacultyRegistrationsPanel = ({ switcher }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'reject' | 'deactivate', request }
  const [toReactivate, setToReactivate] = useState(null);   // request waiting for the confirm pop-up
  const [reactivating, setReactivating] = useState(false);
  const [selected, setSelected] = useState(null);           // request shown in the details pop-up
  const [errorDialog, setErrorDialog] = useState(null);
  const showError = (title, message) => setErrorDialog({ title, message });

  const fetchRequests = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/faculty/registrations`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load faculty registrations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);
  // Reloads only when registrations changed (same shared change check as the student page).
  useChangeWatcher(["registrations"], fetchRequests);

  // A faculty member can have several requests over time (e.g. rejected, then resubmitted):
  // keep only the most recent one for each Employee ID.
  const latestRequests = useMemo(() => {
    const map = {};
    for (const r of requests) {
      const cur = map[r.employee_id];
      if (!cur || new Date(r.created_at) > new Date(cur.created_at) || (r.created_at === cur.created_at && r.request_id > cur.request_id)) {
        map[r.employee_id] = r;
      }
    }
    return Object.values(map);
  }, [requests]);

  // Sends an approve / reject / deactivate / reactivate and updates the row on screen.
  const send = async (path, body, newStatus, request) => {
    try {
      const res = await authFetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (res.ok) {
        setRequests((prev) => prev.map((r) => (r.request_id === request.request_id ? { ...r, approval_status: newStatus } : r)));
        return true;
      }
      showError("Action Failed", result.error || result.message || "Please try again.");
    } catch {
      showError("Can't Reach the Server", "Check that the server is running, then try again.");
    }
    return false;
  };

  const handleApprove = (r) => send("/api/admin/faculty/approve", { request_id: r.request_id }, "approved", r);

  const handleConfirmReason = async (reason) => {
    if (!pendingAction) return;
    const { type, request } = pendingAction;
    const ok = type === "reject"
      ? await send("/api/admin/faculty/reject", { request_id: request.request_id, reason }, "rejected", request)
      : await send("/api/admin/faculty/deactivate", { employee_id: request.employee_id, reason }, "deactivated", request);
    if (ok) setPendingAction(null);
  };

  const handleReactivate = async () => {
    if (!toReactivate) return;
    setReactivating(true);
    await send("/api/admin/faculty/reactivate", { employee_id: toReactivate.employee_id }, "approved", toReactivate);
    setReactivating(false);
    setToReactivate(null);
  };

  // Search + status tab + college filter. Oldest submission first (first come, first served).
  const filtered = latestRequests
    .filter((r) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (r.full_name || "").toLowerCase().includes(term) || (r.employee_id || "").includes(searchTerm);
      const matchesStatus = statusFilter === "All" || r.approval_status === statusFilter.toLowerCase();
      const matchesCollege = collegeFilter === "All Colleges" || toCollegeAcronym(r.college) === collegeFilter;
      return matchesSearch && matchesStatus && matchesCollege;
    })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, collegeFilter, itemsPerPage]);

  const count = (status) => latestRequests.filter((r) => r.approval_status === status).length;
  const pendingCount = count("pending");
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  const viewLabel = [
    statusFilter === "All" ? "All requests" : statusFilter,
    collegeFilter !== "All Colleges" ? collegeFilter : null,
    searchTerm.trim() ? `"${searchTerm.trim()}"` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <PageTitle
        title={
          <>
            Faculty Registrations
            <span className="text-gray-400 font-semibold text-[20px]"> — {viewLabel}</span>
          </>
        }
        subtitle="Check each faculty member's employee ID, then approve or reject. Faculty don't renew — deactivate an account when it should end."
        right={switcher}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Pending"
          value={pendingCount}
          color={pendingCount > 0 ? BRAND.goldText : "#9CA3AF"}
          footer={pendingCount > 0 ? <Pill tone="gold">Needs review</Pill> : <Pill tone="green">All caught up</Pill>}
        />
        <KpiCard label="Approved" value={count("approved")} color={BRAND.green} footer={<span className="text-xs text-gray-500">Active faculty passes</span>} />
        <KpiCard label="Rejected" value={count("rejected")} color={BRAND.red} footer={<span className="text-xs text-gray-500">Can register again</span>} />
        <KpiCard label="Deactivated" value={count("deactivated")} color={BRAND.deep} footer={<span className="text-xs text-gray-500">QR access removed</span>} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput placeholder="Search by name or employee ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <FilterTabs options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} counts={{ Pending: pendingCount }} />
        <FilterSelect value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
          <option value="All Colleges">All Colleges</option>
          {COLLEGE_FILTER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
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
                <th className="px-5 py-4 text-left">Status</th>
                <th className="px-5 py-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F1]">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">No faculty registrations match your filters.</td></tr>
              ) : (
                paginated.map((r) => (
                  <FacultyRegistrationItem
                    key={r.request_id}
                    employeeId={r.employee_id}
                    name={displayNameOf(r)}
                    email={r.email}
                    college={toCollegeAcronym(r.college)}
                    status={r.approval_status}
                    onRowClick={() => setSelected(r)}
                    onApprove={() => handleApprove(r)}
                    onReject={() => setPendingAction({ type: "reject", request: r })}
                    onDeactivate={() => setPendingAction({ type: "deactivate", request: r })}
                    onReactivate={() => setToReactivate(r)}
                  />
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
            rowsPerPage={itemsPerPage}
            onRowsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
            rowsPerPageOptions={[5, 10, 15]}
            totalItems={filtered.length}
            itemLabel="registrations"
          />
        )}
      </div>

      <FacultyDetailsModal visible={!!selected} request={selected} onClose={() => setSelected(null)} />

      <ReasonModal
        visible={!!pendingAction}
        title={pendingAction?.type === "reject" ? "Reject Registration" : "Deactivate Account"}
        actionLabel={pendingAction?.type === "reject" ? "Confirm Reject" : "Confirm Deactivate"}
        tone={pendingAction?.type === "reject" ? "red" : "gold"}
        presetReasons={pendingAction?.type === "reject" ? REJECT_REASONS : DEACTIVATE_REASONS}
        onConfirm={handleConfirmReason}
        onCancel={() => setPendingAction(null)}
      />

      <Dialog
        open={!!toReactivate}
        tone="success"
        title="Reactivate account?"
        message={toReactivate ? `Are you sure you want to reactivate employee ${toReactivate.employee_id}? They will get a new QR pass and can enter the library again.` : ""}
        footer={
          <>
            <button type="button" onClick={() => setToReactivate(null)} className={btn.secondary}>Cancel</button>
            <button type="button" disabled={reactivating} onClick={handleReactivate} className={btn.primary}>
              {reactivating ? "Reactivating…" : "Yes, Reactivate"}
            </button>
          </>
        }
      />

      <Dialog
        open={!!errorDialog}
        tone="error"
        title={errorDialog?.title}
        message={errorDialog?.message}
        footer={<button onClick={() => setErrorDialog(null)} className={btn.primary}>OK</button>}
      />
    </>
  );
};

export default FacultyRegistrationsPanel;