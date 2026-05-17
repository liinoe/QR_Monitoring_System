import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Card from "../../components/Card";
import RegistrationItem from "../../components/RegistrationItem";

const Registrations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRegistrations = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/pending');
      const data = await response.json();
      setRequests(data);
      setLoading(false);
    } catch (err) { setLoading(false); }
  };

  useEffect(() => { fetchRegistrations(); }, []);

    const handleApprove = async (id) => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, admin_id: 1 })
      });
      
      const result = await response.json(); 

      if (response.ok) {
        setRequests(prev => prev.filter(req => req.request_id !== id));
      } else {
        alert(`Approval Failed: ${result.error || result.message}`);
      }
    } catch (err) { 
      alert("Connection Error: Check if server is running"); 
    }
  };

  const handleReject = async (id) => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id })
      });
      if (response.ok) setRequests(prev => prev.filter(req => req.request_id !== id));
    } catch (err) { alert("Error rejecting"); }
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

          <div className="space-y-[15px]">
            {loading ? <p>Loading...</p> : requests.map((req) => (
              <RegistrationItem
                key={req.request_id}
                name={req.full_name}
                details={`${req.student_number} - ${req.program} - ${req.year_level}`}
                date={`Submitted: ${new Date(req.created_at).toLocaleString()}`}
                status={req.approval_status}
                onApprove={() => handleApprove(req.request_id)}
                onReject={() => handleReject(req.request_id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Registrations;