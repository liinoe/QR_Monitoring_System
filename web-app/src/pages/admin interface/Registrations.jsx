import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import RegistrationItem from "../../components/RegistrationItem";
import ReasonModal from "../../components/ReasonModal";
import StudentDetailsModal from "../../components/StudentDetailsModal";
import { authFetch } from "../../auth";
import { collegeAcronyms, toCollegeAcronym } from "../../data/options";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Filter dropdown options are derived from the same collegeAcronyms map
// used for display — one source of truth, so the filter can never fall
// out of sync with what's actually rendered in the table.
const COLLEGE_FILTER_OPTIONS = Object.values(collegeAcronyms);

const STATUS_TABS = ["All", "Pending", "Approved", "Rejected", "Deactivated"];

const REJECT_REASONS = [
  "Invalid or unreadable student ID/documents",
  "Information does not match university records",
  "Duplicate registration",
  "Incomplete personal information",
  "Other (specify below)",
];

const DEACTIVATE_REASONS = [
  "Lost or compromised QR pass",
  "Graduated / no longer enrolled",
  "Transferred to another program/college",
  "Disciplinary action",
  "Other (specify below)",
];

const Registrations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Holds which item is currently being rejected/deactivated, so the
  // ReasonModal knows what it's acting on. null = modal closed.
  const [pendingAction, setPendingAction] = useState(null); // { type: 'reject'|'deactivate', request_id, student_number }
  const [selectedRequest, setSelectedRequest] = useState(null); // full row for the details modal, null = closed

  const fetchRegistrations = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/all`);
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) { setLoading(false); }
  };

  useEffect(() => { fetchRegistrations(); }, []);

  // registration_requests is an append-only history — every resubmission
  // or renewal adds a NEW row rather than editing the old one, on purpose
  // (so a rejection reason isn't lost once the student tries again). This
  // map finds, per student_number, which single row is their most recent
  // submission — that's the only row whose status reflects "what's true
  // right now" and the only one action buttons should apply to.
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
        alert(`Approval Failed: ${result.error || result.message}`);
      }
    } catch (err) {
      alert("Connection Error: Check if server is running");
    }
  };

  const handleReactivate = async (id, studentNumber) => {
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
        alert(`Reactivation Failed: ${result.error || result.message}`);
      }
    } catch (err) {
      alert("Connection Error: Check if server is running");
    }
  };

  // Reject and Deactivate no longer act immediately — they open the reason
  // modal, and the actual API call happens in handleConfirmReason below.
  const openReject = (id) => setPendingAction({ type: 'reject', request_id: id });
  const openDeactivate = (id, studentNumber) => setPendingAction({ type: 'deactivate', request_id: id, student_number: studentNumber });

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
        alert(`${type === 'reject' ? 'Rejection' : 'Deactivation'} Failed: ${result.error || result.message}`);
      }
    } catch (err) {
      alert("Connection Error: Check if server is running");
    }
  };

  // FILTER
  const filteredRequests = requests.filter((req) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (req.full_name || "").toLowerCase().includes(term) ||
      (req.student_number || "").includes(searchTerm);

    const matchesStatus =
      statusFilter === "All" || req.approval_status === statusFilter.toLowerCase();

    const matchesCollege =
      collegeFilter === "All Colleges" || toCollegeAcronym(req.college) === collegeFilter;

    return matchesSearch && matchesStatus && matchesCollege;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, collegeFilter, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px] pb-[40px]">
          <p className="text-[#666]">Approve, reject, or review pending student registrations.</p>

          <div className="grid grid-cols-4 gap-[20px]">
            <Card title="Pending" value={requests.filter(r => r.approval_status === 'pending').length} color="text-[#E76D22]" border="border-[#E76D22]" />
            <Card title="Approved" value={requests.filter(r => r.approval_status === 'approved').length} color="text-[#1B651B]" border="border-[#1B651B]" />
            <Card title="Rejected" value={requests.filter(r => r.approval_status === 'rejected').length} color="text-[#812022]" border="border-[#812022]" />
            <Card title="Total Requests" value={requests.length} color="text-[#225276]" border="border-[#225276]" />
          </div>

          {/* SEARCH AND FILTERS */}
          <div className="flex justify-between items-center flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search students..."
              className="pl-4 pr-4 py-2 border rounded-lg w-[280px] bg-white outline-none focus:ring-1 focus:ring-green-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="flex gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === tab
                      ? "bg-[#1B651B] text-white"
                      : "bg-white text-gray-600 border hover:bg-gray-50"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <select
              className="border px-4 py-2 rounded-lg bg-white text-gray-600"
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
            >
              <option>All Colleges</option>
              {COLLEGE_FILTER_OPTIONS.map((college) => (
                <option key={college} value={college}>{college}</option>
              ))}
            </select>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-[10px] border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-[#F3FAF3] text-[#1B651B] border-b">
                <tr>
                  <th className="p-4 text-left font-semibold">Student No.</th>
                  <th className="p-4 text-left font-semibold">Name</th>
                  <th className="p-4 text-left font-semibold">College</th>
                  <th className="p-4 text-left font-semibold">Program</th>
                  <th className="p-4 text-left font-semibold">Status</th>
                  <th className="p-4 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading...</td></tr>
                ) : filteredRequests.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">No registrations match your filters.</td></tr>
                ) : (
                  paginatedRequests.map((req) => {
                    const latest = latestRequestByStudent[req.student_number];
                    const isLatest = latest?.request_id === req.request_id;
                    return (
                      <RegistrationItem
                        key={req.request_id}
                        studentNumber={req.student_number}
                        name={req.full_name}
                        email={req.email}
                        college={toCollegeAcronym(req.college)}
                        program={req.program}
                        status={req.approval_status}
                        isLatest={isLatest}
                        currentStatus={latest?.approval_status}
                        onRowClick={() => setSelectedRequest(req)}
                        onApprove={() => handleApprove(req.request_id)}
                        onReject={() => openReject(req.request_id)}
                        onDeactivate={() => openDeactivate(req.request_id, req.student_number)}
                        onReactivate={() => handleReactivate(req.request_id, req.student_number)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION FOOTER */}
          {!loading && filteredRequests.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <select
                className="border px-3 py-2 rounded-lg bg-white text-gray-600 text-sm"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                <option value={5}>5 items</option>
                <option value={10}>10 items</option>
                <option value={15}>15 items</option>
              </select>

              <p className="text-sm text-gray-500">
                Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredRequests.length)} of {filteredRequests.length} registrations
              </p>

              <div className="flex items-center gap-2">
                <span className="w-8 h-8 flex items-center justify-center bg-[#1B651B] text-white rounded-lg text-sm font-medium">
                  {currentPage}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded-lg bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border rounded-lg bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <StudentDetailsModal
        visible={!!selectedRequest}
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />

      <ReasonModal
        visible={!!pendingAction}
        title={pendingAction?.type === 'reject' ? 'Reject Registration' : 'Deactivate Account'}
        actionLabel={pendingAction?.type === 'reject' ? 'Confirm Reject' : 'Confirm Deactivate'}
        actionColor={pendingAction?.type === 'reject' ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#D97706] hover:bg-[#B45309]'}
        presetReasons={pendingAction?.type === 'reject' ? REJECT_REASONS : DEACTIVATE_REASONS}
        onConfirm={handleConfirmReason}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default Registrations;