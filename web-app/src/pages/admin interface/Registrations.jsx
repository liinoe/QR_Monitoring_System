import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import RegistrationItem from "../../components/RegistrationItem";
import { authFetch } from "../../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const COLLEGE_OPTIONS = [
  "CAFENR", "CAS", "CCJ", "CED", "CEIT", "CEMDS", "CON", "CSPEAR", "CTHM", "CVMBS", 'COM', 'CAPS',
];

const COLLEGE_ACRONYMS = {
  "college of agriculture, food, environment, and natural resources": "CAFENR",
  "college of agriculture, forestry, environment and natural resources": "CAFENR",
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
  "college of advanced and professional studies": "CAPS"
};

const toAcronym = (college) => {
  if (!college) return null;
  const key = college.trim().toLowerCase();
  return COLLEGE_ACRONYMS[key] || college.trim().toUpperCase();
};

const STATUS_TABS = ["All", "Pending", "Approved", "Rejected", "Deactivated"];

const Registrations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [collegeFilter, setCollegeFilter] = useState("All Colleges");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRegistrations = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/all`);
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) { setLoading(false); }
  };

  useEffect(() => { fetchRegistrations(); }, []);

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

  const handleReject = async (id) => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id })
      });
      if (response.ok) setRequests(prev => prev.map(req =>
        req.request_id === id ? { ...req, approval_status: 'rejected' } : req
      ));
    } catch (err) { alert("Error rejecting"); }
  };

  const handleDeactivate = async (id, studentNumber) => {
    try {
      const response = await authFetch(`${API_URL}/api/admin/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, student_number: studentNumber })
      });
      const result = await response.json();
      if (response.ok) {
        setRequests(prev => prev.map(req =>
          req.request_id === id ? { ...req, approval_status: 'deactivated' } : req
        ));
      } else {
        alert(`Deactivation Failed: ${result.error || result.message}`);
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

  // FILTER
  const filteredRequests = requests.filter((req) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (req.full_name || "").toLowerCase().includes(term) ||
      (req.student_number || "").includes(searchTerm);

    const matchesStatus =
      statusFilter === "All" || req.approval_status === statusFilter.toLowerCase();

    const matchesCollege =
      collegeFilter === "All Colleges" || toAcronym(req.college) === collegeFilter;

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
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px]">
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
              {COLLEGE_OPTIONS.map((college) => (
                <option key={college} value={college}>{college}</option>
              ))}
            </select>
          </div>

          <div className="space-y-[15px]">
            {loading ? (
              <p>Loading...</p>
            ) : filteredRequests.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">No registrations match your filters.</p>
            ) : (
              paginatedRequests.map((req) => (
                <RegistrationItem
                  key={req.request_id}
                  name={req.full_name}
                  details={`${req.student_number} - ${req.program} - ${req.year_level}`}
                  date={`Submitted: ${new Date(req.created_at).toLocaleString()}`}
                  status={req.approval_status}
                  onApprove={() => handleApprove(req.request_id)}
                  onReject={() => handleReject(req.request_id)}
                  onDeactivate={() => handleDeactivate(req.request_id, req.student_number)}
                  onReactivate={() => handleReactivate(req.request_id, req.student_number)}
                />
              ))
            )}
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
    </div>
  );
};

export default Registrations;