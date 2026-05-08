import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import FilterButton from "../../components/FilterButton";
import RegistrationItem from "../../components/RegistrationItem";

const Registrations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch data from your backend
  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/admin/pending');
        const data = await response.json();
        setRequests(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load registrations:", err);
        setLoading(false);
      }
    };
    fetchRegistrations();
  }, []);

  // 2. Approval Logic
  const handleApprove = async (id) => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id })
      });
      
      if (response.ok) {
        // Refresh local list after successful approval
        setRequests(requests.filter(req => req.request_id !== id));
      }
    } catch (err) {
      alert("Error approving student");
    }
  };

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px]">
          <p className="text-[#666]">Approve, reject, or review pending student registrations.</p>

          <div className="grid grid-cols-4 gap-[20px]">
            <Card title="Pending" value={requests.length} color="text-[#E76D22]" border="border-[#E76D22]" />
            <Card title="Approved" value="--" color="text-[#1B651B]" border="border-[#1B651B]" />
            <Card title="Rejected" value="--" color="text-[#812022]" border="border-[#812022]" />
            <Card title="Total Requests" value={requests.length} color="text-[#225276]" border="border-[#225276]" />
          </div>

          {/* LIST - Now Dynamic */}
          <div className="space-y-[15px]">
            {loading ? (
              <p>Loading registrations...</p>
            ) : requests.length === 0 ? (
              <p className="text-gray-400 italic">No pending registrations found.</p>
            ) : (
              requests.map((req) => (
                <RegistrationItem
                  key={req.request_id}
                  name={req.full_name}
                  details={`${req.student_number} - ${req.program} - ${req.year_level}`}
                  date={`Submitted: ${new Date(req.created_at).toLocaleString()}`}
                  status={req.approval_status}
                  // Pass the approval function to the component
                  onApprove={() => handleApprove(req.request_id)}
                />
              ))
            )}
          </div>

          <p className="text-[#666] text-sm">
            Showing {requests.length} pending registration(s)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Registrations;