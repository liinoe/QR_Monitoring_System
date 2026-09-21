import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import SearchInput from "../../components/SearchInput";
import FilterSelect from "../../components/FilterSelect";
import FilterTabs from "../../components/FilterTabs";
import Pagination from "../../components/Pagination";
import RegistrationItem from "../../components/RegistrationItem";
import ReasonModal from "../../components/ReasonModal";
import StudentDetailsModal from "../../components/StudentDetailsModal";
import { authFetch } from "../../auth";
import { collegeAcronyms, toCollegeAcronym } from "../../data/options";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const COLLEGE_FILTER_OPTIONS = Object.values(collegeAcronyms);

const STATUS_TABS = ["All", "Pending", "Pending Renewal", "Approved", "Rejected", "Deactivated"];

const REJECT_REASONS = [
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
  const [currentPeriod, setCurrentPeriod] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingAction, setPendingAction] = useState(null); 
  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchRegistrations = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/all`);
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) { setLoading(false); }
  };

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

  useEffect(() => { 
    fetchRegistrations(); 
    fetchCurrentPeriod();
  }, []);

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

  const latestRequestsList = useMemo(
    () => Object.values(latestRequestByStudent),
    [latestRequestByStudent]
  );

  const currentPeriodRequests = useMemo(
  () => latestRequestsList.filter((req) => req.period === currentPeriod),
  [latestRequestsList, currentPeriod]
);

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

  // Filtered first, then sorted FIRST-COME-FIRST-SERVED — oldest
  // submission (created_at) first, so whoever registered earliest is
  // reviewed earliest, matching a normal registrar queue rather than
  // whatever order the backend happened to return.
  const filteredRequests = latestRequestsList
    .filter((req) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (req.full_name || "").toLowerCase().includes(term) ||
        (req.student_number || "").includes(searchTerm);

      const studentRequests = requests.filter(r => r.student_number === req.student_number);
      const isRenewal = studentRequests.length > 1 && req.period === currentPeriod;
      const effectiveStatus = (req.approval_status === "pending" && isRenewal) ? "pending renewal" : req.approval_status;

      const matchesStatus =
        statusFilter === "All" || effectiveStatus === statusFilter.toLowerCase();

      const matchesCollege =
        collegeFilter === "All Colleges" || toCollegeAcronym(req.college) === collegeFilter;

      return matchesSearch && matchesStatus && matchesCollege;
    })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

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
          <p className="text-sm font-medium text-[#1B651B]">
            Current Academic Period: {currentPeriod || "Loading..."}
          </p>
          <div className="grid grid-cols-4 gap-[20px]">
            <Card title="Pending" value={currentPeriodRequests.filter(r => r.approval_status === 'pending').length} color="text-[#E76D22]" border="border-[#E76D22]" />
            <Card title="Approved" value={currentPeriodRequests.filter(r => r.approval_status === 'approved').length} color="text-[#1B651B]" border="border-[#1B651B]" />
            <Card title="Rejected" value={currentPeriodRequests.filter(r => r.approval_status === 'rejected').length} color="text-[#812022]" border="border-[#812022]" />
            <Card title="Total Requests" value={currentPeriodRequests.length} color="text-[#225276]" border="border-[#225276]" />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <FilterTabs options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />

            <FilterSelect value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
              <option value="All Colleges">All Colleges</option>
              {COLLEGE_FILTER_OPTIONS.map((college) => (
                <option key={college} value={college}>{college}</option>
              ))}
            </FilterSelect>
          </div>

          <div className="bg-white rounded-[10px] border shadow-sm">
            <div className="overflow-x-auto rounded-t-[10px] overflow-hidden">
              <table className="responsive-table w-full text-sm">
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
                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading...</td></tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">No registrations match your filters.</td></tr>
                  ) : (
                    paginatedRequests.map((req) => {
                      const latest = latestRequestByStudent[req.student_number];
                      const isLatest = latest?.request_id === req.request_id;
                      
                      const studentRequests = requests.filter(r => r.student_number === req.student_number);
                      const isRenewal = studentRequests.length > 1 && req.period === currentPeriod;

                      let displayStatus = req.approval_status;
                      if (req.approval_status === "pending") {
                        if (req.period === currentPeriod) {
                          displayStatus = isRenewal ? "pending renewal" : "pending";
                        } else {
                          displayStatus = "expired / unapproved";
                        }
                      }

                      const displayName = req.first_name && req.surname
                        ? (req.middle_name 
                            ? `${req.first_name} ${req.middle_name.charAt(0).toUpperCase()}. ${req.surname}` 
                            : `${req.first_name} ${req.surname}`)
                        : req.full_name;

                      return (
                        <RegistrationItem
                          key={req.request_id}
                          studentNumber={req.student_number}
                          name={displayName}
                          email={req.email}
                          college={toCollegeAcronym(req.college)}
                          program={req.program}
                          period={req.period}
                          status={displayStatus}
                          isLatest={isLatest}
                          currentStatus={latest?.approval_status === 'pending' && isRenewal ? 'pending renewal' : latest?.approval_status}
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
        </div>
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
        actionColor={pendingAction?.type === 'reject' ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#D97706] hover:bg-[#B45309]'}
        presetReasons={pendingAction?.type === 'reject' ? REJECT_REASONS : DEACTIVATE_REASONS}
        onConfirm={handleConfirmReason}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default Registrations;