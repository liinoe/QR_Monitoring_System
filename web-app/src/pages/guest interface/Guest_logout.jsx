import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/cvsu_logo.png";

const GuestLogout = () => {
  const navigate = useNavigate();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [loggingOutId, setLoggingOutId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  
  // New state for the confirmation modal
  const [guestToConfirm, setGuestToConfirm] = useState(null);

  const fetchInsideGuests = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/guests/inside");
      const data = await res.json();
      setGuests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load guests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInsideGuests(); }, []);

  const handleLogout = async () => {
    if (!guestToConfirm) return;
    
    const guest_log_id = guestToConfirm.guest_log_id;
    setLoggingOutId(guest_log_id);
    setGuestToConfirm(null); // Close the modal immediately
    setFeedback(null);
    
    try {
      const res = await fetch(`http://localhost:5000/api/guests/self-exit/${guest_log_id}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", message: data.message || "Logged out successfully!" });
        setGuests((prev) => prev.filter((g) => g.guest_log_id !== guest_log_id));
        setTimeout(() => navigate("/guest-landing"), 1800);
      } else {
        setFeedback({ type: "error", message: data.message || "Could not log out. Please try again." });
        fetchInsideGuests();
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Cannot reach the server. Please check your connection." });
    } finally {
      setLoggingOutId(null);
    }
  };

  const filteredGuests = guests.filter((g) =>
    (g.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayReason = (g) =>
    g.purpose === "Other" && g.other_purpose ? g.other_purpose : g.purpose || "—";

  return (
    <div className="min-h-screen w-screen bg-[#EAF5EA] font-sans flex flex-col relative">
      {/* HEADER */}
      <div className="bg-[#1B5E20] text-white px-6 h-[72px] flex items-center justify-between shadow-md border-b-[3px] border-[#F5C518] flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <img src={logo} alt="CvSU Logo" className="w-12 h-12 object-contain flex-shrink-0" />
          <div>
            <p className="text-[17px] font-bold leading-tight">Library Patron Access and Monitoring System</p>
            <p className="text-[11px] opacity-75 mt-0.5">Guest Logout</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/guest-landing")}
          className="text-white text-sm font-medium hover:underline"
        >
          ← Back
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex justify-center py-10 px-4">
        <div className="w-full max-w-[680px] space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Find Your Name</h2>
            <p className="text-sm text-gray-500">
              Search for your name below and tap "Log Out" to end your visit.
            </p>
          </div>

          {feedback && (
            <div
              className={`rounded-xl p-4 text-sm font-medium ${
                feedback.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Type your name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>

            <table className="w-full text-sm">
              <thead className="bg-[#F3FAF3] text-[#1B651B]">
                <tr>
                  <th className="p-3 text-left font-semibold">Name</th>
                  <th className="p-3 text-left font-semibold">Reason for Visit</th>
                  <th className="p-3 text-left font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="p-6 text-center text-gray-400">Loading...</td></tr>
                ) : filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      {guests.length === 0 ? "No guests currently inside." : "No match found."}
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((g) => (
                    <tr key={g.guest_log_id} className="border-t">
                      <td className="p-3 text-gray-800">{g.full_name}</td>
                      <td className="p-3 text-gray-600">{displayReason(g)}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setGuestToConfirm(g)}
                          disabled={loggingOutId === g.guest_log_id}
                          className="bg-[#1B5E20] hover:bg-[#164a1a] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {loggingOutId === g.guest_log_id ? "Logging out..." : "Log Out"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {guestToConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full transform transition-all">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Confirm Logout</h3>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to log out{" "}
              <span className="font-semibold text-gray-900">
                {guestToConfirm.full_name}
              </span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setGuestToConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1B5E20] hover:bg-[#164a1a] rounded-lg transition-colors"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestLogout;