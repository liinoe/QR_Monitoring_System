import React from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";

const Settings = () => {
  const handleArchive = async () => {
    if (window.confirm("Archive logs older than 3 months? This maintains system speed and performance.")) {
      try {
        const response = await fetch('http://localhost:5000/api/logs/archive', { method: 'POST' });
        if (response.ok) {
          alert("Old logs moved to archive successfully!");
        } else {
          alert("Failed to archive logs.");
        }
      } catch (error) {
        console.error("Archive error:", error);
      }
    }
  };

  return (
    <div className="w-screen min-h-screen flex flex-col bg-[#F6F6F5] font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 px-[50px] pt-[40px] space-y-[20px]">
          <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>
          
          {/* ARCHIVE SECTION */}
          <div className="bg-white p-6 rounded-[10px] border shadow-sm">
            <h2 className="text-lg font-semibold text-gray-700">Data Management</h2>
            <p className="text-sm text-gray-500 mb-4">
              Manage database performance by archiving logs older than 3 months. 
              This helps reduce server load and maintain entry/exit scanning speed.
            </p>
            <button 
              onClick={handleArchive} 
              className="bg-[#1B651B] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#165516] transition-colors"
            >
              Archive Old Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;