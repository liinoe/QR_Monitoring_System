import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import FilterTabs from "../../components/FilterTabs";
import Pagination from "../../components/Pagination";
import RegistrationItem from "../../components/RegistrationItem";
import ReasonModal from "../../components/ReasonModal";
import StudentDetailsModal from "../../components/StudentDetailsModal";
import { authFetch } from "../../auth";
import useChangeWatcher from "../../components/useChangeWatcher";
import { collegeAcronyms, toCollegeAcronym } from "../../data/options";
import { BRAND, PageTitle, SectionLabel, KpiCard, Pill, Dialog, btn } from "../../components/AdminUI";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const COLLEGE_FILTER_OPTIONS = Object.values(collegeAcronyms);

// Status tabs. Students whose pass ended with the semester ("Semester Ended") and old
// requests nobody answered ("Not Reviewed") have no action to take, so they only
// appear under "All".
const STATUS_TABS = ["All", "Pending", "Pending Renewal", "Approved", "Rejected", "Deactivated"];

// Reasons the admin can pick when rejecting. The chosen text is shown to the
// student in the mobile app, so keep them short and clear.
const REJECT_REASONS = [
  "Not enrolled in the current semester",
  "Information does not match university records",
  "Details are unclear or invalid (e.g. name, address)",
  "Other (specify below)",
];

// Reasons the admin can pick when deactivating an approved account.
const DEACTIVATE_REASONS = [
  "Lost or compromised QR pass",
  "Graduated / no longer enrolled",
  "Transferred to another program/college",
  "Disciplinary action",
  "Other (specify below)",
];

// Admin page for reviewing student registrations: approve, reject, deactivate, reactivate.
const Registrations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending"); // Pending is always the opening tab
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingAction, setPendingAction] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newCount, setNewCount] = useState(0); // new registrations since the last check (for the notice)
  // Error pop-up (replaces the browser's alert boxes).
  const [errorDialog, setErrorDialog] = useState(null);
  // Student waiting for the "Reactivate account?" confirm: { id, studentNumber }
  const [toReactivate, setToReactivate] = useState(null);
  const [reactivating, setReactivating] = useState(false);

  // Shows the error pop-up with a title and message.
  const showError = (title, message) => setErrorDialog({ title, message });

  // Downloads every registration request and puts it on screen.
  const fetchRegistrations = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/all`);
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) { setLoading(false); }
  };

  // Gets the active semester (e.g. "1st Semester A.Y. 2026-2027") shown at the top.
  const fetchCurrentPeriod = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/settings/current-period`);
      const data = await response.json();
      if (data.current_period) {
        setCurrentPeriod(data.current_period);
      }
    } catch (err) {
      console.error("Failed to fetch current period");
    }
  };

  // On page open: load the list and the semester once.
  useEffect(() => {
    fetchRegistrations();
    fetchCurrentPeriod();
  }, []);

  // Then reloads the list only when registrations changed (new registration, renewal,
  // or another admin approved / rejected something) — using the shared change check,
  // the same request the sidebar badge listens to. Also counts new arrivals for the notice.
  useChangeWatcher(["registrations"], (now, before) => {
    const added = (now?.registrations_total ?? 0) - (before?.registrations_total ?? 0);
    if (added > 0) setNewCount((n) => n + added);
    fetchRegistrations();
  });

  // Hides the "new registration" notice by itself after a few seconds.
  useEffect(() => {
    if (newCount === 0) return;
    const timer = setTimeout(() => setNewCount(0), 6000);
    return () => clearTimeout(timer);
  }, [newCount]);

  // For each student, keeps only their most recent request (a student can have
  // several over time, e.g. an old one plus a renewal).
  const latestRequestByStudent = useMemo(() => {
    const map = {};
    for (const req of requests) {
      const current = map[req.student_number];
      if (!current || new Date(req.created_at) > new Date(current.created_at)) {
        map[req.student_number] = req;
      }
    }
    return map;
  }, [requests]);

  // Same as above, but as a plain list (easier to filter and sort).
  const latestRequestsList = useMemo(
    () => Object.values(latestRequestByStudent),
    [latestRequestByStudent]
  );

  // Only the requests for the active semester — used for the count cards at the top.
  const currentPeriodRequests = useMemo(
    () => latestRequestsList.filter((req) => req.period === currentPeriod),
    [latestRequestsList, currentPeriod]
  );

  // Approves a request: the student gets a QR pass. Updates the row on screen right away.
  const handleApprove = async (id) => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id })
      });
      const result = await response.json();
      if (response.ok) {
        setRequests(prev => prev.map(req =>
          req.request_id === id ? { ...req, approval_status: 'approved' } : req
        ));
      } else {
        showError("Approval Failed", result.error || result.message || "Please try again.");
      }
    } catch (err) {
      showError("Can't Reach the Server", "Check that the server is running, then try again.");
    }
  };

  // "Yes, Reactivate" in the confirm pop-up: turns the deactivated account back on
  // and issues a new QR pass.
  const handleReactivate = async () => {
    if (!toReactivate) return;
    const { id, studentNumber } = toReactivate;
    setReactivating(true);
    try {
      const response = await authFetch(`${API_URL}/api/admin/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, student_number: studentNumber })
      });
      const result = await response.json();
      if (response.ok) {
        setRequests(prev => prev.map(req =>
          req.request_id === id ? { ...req, approval_status: 'approved' } : req
        ));
      } else {
        showError("Reactivation Failed", result.error || result.message || "Please try again.");
      }
    } catch (err) {
      showError("Can't Reach the Server", "Check that the server is running, then try again.");
    } finally {
      setReactivating(false);
      setToReactivate(null);
    }
  };

  // Opens the reason pop-up for rejecting a request.
  const openReject = (id) => setPendingAction({ type: 'reject', request_id: id });
  // Opens the reason pop-up for deactivating an approved account.
  const openDeactivate = (id, studentNumber) => setPendingAction({ type: 'deactivate', request_id: id, student_number: studentNumber });

  // Runs when the admin confirms the reason pop-up: sends the reject or
  // deactivate request (with the reason) and updates the row on screen.
  const handleConfirmReason = async (reason) => {
    if (!pendingAction) return;
    const { type, request_id, student_number } = pendingAction;

    try {
      const url = type === 'reject' ? `${API_URL}/api/admin/reject` : `${API_URL}/api/admin/deactivate`;
      const body = type === 'reject'
        ? { request_id, reason }
        : { request_id, student_number, reason };

      const response = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (response.ok) {
        setRequests(prev => prev.map(req =>
          req.request_id === request_id
            ? { ...req, approval_status: type === 'reject' ? 'rejected' : 'deactivated' }
            : req
        ));
        setPendingAction(null);
      } else {
        showError(`${type === 'reject' ? 'Rejection' : 'Deactivation'} Failed`, result.error || result.message || "Please try again.");
      }
    } catch (err) {
      showError("Can't Reach the Server", "Check that the server is running, then try again.");
    }
  };

  // True if this request is a RENEWAL: it's for the current semester and the
  // student was already APPROVED in an earlier semester. A student who was
  // rejected and resubmitted this semester was never approved, so they stay
  // plain "pending" (not "pending renewal").
  const isRenewalRequest = (req) =>
    req.period === currentPeriod &&
    requests.some(
      (r) =>
        r.student_number === req.student_number &&
        r.request_id !== req.request_id &&
        r.period !== currentPeriod &&
        // "expired" = was approved, and that semester has ended
        (r.approval_status === "approved" || r.approval_status === "expired")
    );

  // The status we show and filter by. Adds states the database doesn't store:
  //   "not reviewed"     pending from an earlier semester (nobody answered it)
  //   "pending renewal"  renewal for this semester (Approve / Reject show once the student submits)
  //   "pending"          new registration
  const statusOf = (req) => {
    if (!req || req.approval_status !== "pending") return req?.approval_status;
    if (req.period !== currentPeriod) return "not reviewed";
    return isRenewalRequest(req) ? "pending renewal" : "pending";
  };

  // How many are waiting in each tab (the small numbers on the tabs).
  const actionCounts = {
    Pending: latestRequestsList.filter((r) => statusOf(r) === "pending").length,
    "Pending Renewal": latestRequestsList.filter((r) => statusOf(r) === "pending renewal").length,
  };


  // Applies the search box, status tab and college filter, then sorts
  // first-come-first-served (oldest submission first), like a registrar queue,
  // with renewals still waiting for the student at the bottom.
  const filteredRequests = latestRequestsList
    .filter((req) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (req.full_name || "").toLowerCase().includes(term) ||
        (req.student_number || "").includes(searchTerm);

      const effectiveStatus = statusOf(req);

      const matchesStatus =
        statusFilter === "All" || effectiveStatus === statusFilter.toLowerCase();

      const matchesCollege =
        collegeFilter === "All Colleges" || toCollegeAcronym(req.college) === collegeFilter;

      return matchesSearch && matchesStatus && matchesCollege;
    })
    .sort((a, b) => {
      // Rejected tab: this semester's rejections first, then earlier semesters;
      // newest first in each group (it's a history list, not a queue to work through).
      if (statusFilter === "Rejected") {
        const aOld = a.period !== currentPeriod;
        const bOld = b.period !== currentPeriod;
        if (aOld !== bOld) return aOld ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      }
      // Renewals the student hasn't submitted yet (no academic info) can't be
      // approved, so they go below the ones that are ready.
      const aWaiting = statusOf(a) === "pending renewal" && !a.college;
      const bWaiting = statusOf(b) === "pending renewal" && !b.college;
      if (aWaiting !== bWaiting) return aWaiting ? 1 : -1;
      // Otherwise first come, first served (submitting a renewal updates created_at).
      return new Date(a.created_at) - new Date(b.created_at);
    });

  // Go back to page 1 whenever a filter changes, so results aren't hidden on a later page.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, collegeFilter, itemsPerPage]);

  // KPI numbers for this semester. "Pending" includes pending renewals.
  const pendingCount = currentPeriodRequests.filter((r) => r.approval_status === "pending").length;
  const approvedCount = currentPeriodRequests.filter((r) => r.approval_status === "approved").length;
  const rejectedCount = currentPeriodRequests.filter((r) => r.approval_status === "rejected").length;
  const totalCount = currentPeriodRequests.length;
  // Share of this semester's requests, e.g. 4 of 7 → "57% of requests".
  const shareOf = (n) => (totalCount > 0 ? `${Math.round((n / totalCount) * 100)}% of requests` : "No requests yet");
  // How many of this semester's requests are renewals vs first-time registrations.
  const renewalCount = currentPeriodRequests.filter((r) => isRenewalRequest(r)).length;

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="w-screen min-h-screen flex flex-col font-sans" style={{ backgroundColor: BRAND.page }}>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-8 space-y-6">
          <PageTitle
            title="Registrations"
            subtitle="Approve, reject, or review student registrations."
            right={<Pill tone="green">{currentPeriod || "Loading semester..."}</Pill>}
          />

          {/* Small notice when new registrations arrive while the page is open */}
          {newCount > 0 && (
            <div className="flex items-center gap-2 bg-[#E8F1E9] text-[#1B5E20] text-sm font-semibold px-4 py-2.5 rounded-[14px]">
              <span className="w-2 h-2 rounded-full bg-[#1B5E20] animate-pulse" />
              {newCount === 1 ? "1 new registration received" : `${newCount} new registrations received`}
            </div>
          )}

          {/* KPI CARDS (this semester only) */}
          <div>
          <SectionLabel>This semester</SectionLabel>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            <KpiCard
              label="Pending"
              value={pendingCount}
              color={pendingCount > 0 ? BRAND.goldText : "#9CA3AF"}
              footer={pendingCount > 0 ? <Pill tone="gold">Needs review</Pill> : <Pill tone="green">All caught up</Pill>}
            />
            <KpiCard
              label="Approved"
              value={approvedCount}
              color={BRAND.green}
              footer={<span className="text-xs text-gray-500">{shareOf(approvedCount)}</span>}
            />
            <KpiCard
              label="Rejected"
              value={rejectedCount}
              color={BRAND.red}
              footer={<span className="text-xs text-gray-500">{shareOf(rejectedCount)}</span>}
            />
            <KpiCard
              label="Total Requests"
              value={totalCount}
              color={BRAND.deep}
              footer={
                <span className="text-xs text-gray-500">
                  {totalCount - renewalCount} new · {renewalCount} {renewalCount === 1 ? "renewal" : "renewals"}
                </span>
              }
            />
          </div>
          </div>

          {/* SEARCH AND FILTERS */}
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search by name or student no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <FilterTabs options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} counts={actionCounts} />

            <FilterSelect value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
              <option value="All Colleges">All Colleges</option>
              {COLLEGE_FILTER_OPTIONS.map((college) => (
                <option key={college} value={college}>{college}</option>
              ))}
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
                    <th className="px-5 py-4 text-left">Status</th>
                    <th className="px-5 py-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F3F1]">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">Loading...</td></tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">No registrations match your filters.</td></tr>
                  ) : (
                    paginatedRequests.map((req, i) => {
                      const latest = latestRequestByStudent[req.student_number];
                      // Rejected tab: small "This semester" / "Earlier semesters" heading
                      // above the first row of each group (and at the top of every page).
                      const isOld = req.period !== currentPeriod;
                      const showGroupHeading =
                        statusFilter === "Rejected" &&
                        (i === 0 || (paginatedRequests[i - 1].period !== currentPeriod) !== isOld);
                      const isLatest = latest?.request_id === req.request_id;

                      // Label shown in the Status column (see statusOf above).
                      const displayStatus = statusOf(req);

                      // "Juan D. Dela Cruz" style name (falls back to full_name for old records).
                      const displayName = req.first_name && req.surname
                        ? (req.middle_name
                            ? `${req.first_name} ${req.middle_name.charAt(0).toUpperCase()}. ${req.surname}`
                            : `${req.first_name} ${req.surname}`)
                        : req.full_name;

                      return (
                        <React.Fragment key={req.request_id}>
                        {showGroupHeading && (
                          <tr className="bg-[#F7F8F7]">
                            <td colSpan={5} className="px-5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">
                              {isOld ? "Earlier semesters" : `This semester · ${currentPeriod}`}
                            </td>
                          </tr>
                        )}
                        <RegistrationItem
                          studentNumber={req.student_number}
                          name={displayName}
                          email={req.email}
                          college={toCollegeAcronym(req.college)}
                          program={req.program}
                          period={req.period}
                          status={displayStatus}
                          isLatest={isLatest}
                          currentStatus={statusOf(latest)}
                          onRowClick={() => setSelectedRequest(req)}
                          onApprove={() => handleApprove(req.request_id)}
                          onReject={() => openReject(req.request_id)}
                          onDeactivate={() => openDeactivate(req.request_id, req.student_number)}
                          onReactivate={() => setToReactivate({ id: req.request_id, studentNumber: req.student_number })}
                        />
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredRequests.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                rowsPerPage={itemsPerPage}
                onRowsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
                rowsPerPageOptions={[5, 10, 15]}
                totalItems={filteredRequests.length}
                itemLabel="registrations"
              />
            )}
          </div>
        </main>
      </div>

      <StudentDetailsModal
        visible={!!selectedRequest}
        request={selectedRequest}
        currentPeriod={currentPeriod}
        allRequests={requests}
        onClose={() => setSelectedRequest(null)}
      />

      <ReasonModal
        visible={!!pendingAction}
        title={pendingAction?.type === 'reject' ? 'Reject Registration' : 'Deactivate Account'}
        actionLabel={pendingAction?.type === 'reject' ? 'Confirm Reject' : 'Confirm Deactivate'}
        tone={pendingAction?.type === 'reject' ? 'red' : 'gold'}
        presetReasons={pendingAction?.type === 'reject' ? REJECT_REASONS : DEACTIVATE_REASONS}
        onConfirm={handleConfirmReason}
        onCancel={() => setPendingAction(null)}
      />

      {/* Reactivate confirm */}
      <Dialog
        open={!!toReactivate}
        tone="success"
        title="Reactivate account?"
        message={toReactivate ? `Are you sure you want to reactivate ${toReactivate.studentNumber}? They will get a new QR pass and can enter the library again.` : ""}
        footer={
          <>
            <button type="button" onClick={() => setToReactivate(null)} className={btn.secondary}>Cancel</button>
            <button type="button" disabled={reactivating} onClick={handleReactivate} className={btn.primary}>
              {reactivating ? "Reactivating…" : "Yes, Reactivate"}
            </button>
          </>
        }
      />

      {/* Error pop-up */}
      <Dialog
        open={!!errorDialog}
        tone="error"
        title={errorDialog?.title}
        message={errorDialog?.message}
        footer={<button onClick={() => setErrorDialog(null)} className={btn.primary}>OK</button>}
      />
    </div>
  );
};

export default Registrations;