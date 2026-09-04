import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/cvsu_logo.png";

const FacultyIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1B5E20' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const AlumniIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1B5E20' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10L12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
  </svg>
);

const WalkinIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1B5E20' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4.5" r="2" />
    <path d="M10 8l2 3 2-3" />
    <path d="M12 11v5" />
    <path d="M12 16l-3 5" />
    <path d="M12 16l3 5" />
    <path d="M9 13l-3 2" />
  </svg>
);

const OtherIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#1B5E20' : '#9ca3af'}>
    <circle cx="6" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18" cy="12" r="1.6" />
  </svg>
);

const VISITOR_TYPES = [
  { id: "faculty", label: "Faculty", icon: FacultyIcon },
  { id: "alumni", label: "Alumni", icon: AlumniIcon },
  { id: "walkin", label: "Walk-in", icon: WalkinIcon },
  { id: "other", label: "Other", icon: OtherIcon },
];

const PURPOSES = ["Book Reference", "Research / Thesis", "Museum Visit", "General Reading"];

const GuestEntry = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [guestType, setGuestType] = useState("faculty");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [purpose, setPurpose] = useState("Book Reference");
  const [otherPurpose, setOtherPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); 

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resetForm = () => {
    setGuestType("faculty");
    setFirstName("");
    setLastName("");
    setAffiliation("");
    setPurpose("Book Reference");
    setOtherPurpose("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setFeedback({ type: "error", message: "Please enter your first and last name." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("http://localhost:5000/api/guests/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_type: guestType,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          affiliation: affiliation.trim(),
          purpose,
          other_purpose: otherPurpose.trim(),
        }),
      });

      if (response.ok) {
        setFeedback({ type: "success", message: "Visit logged successfully! Welcome to the library." });
        resetForm();
        setTimeout(() => navigate("/guest-landing"), 1500);
      } else {
        const result = await response.json();
        setFeedback({ type: "error", message: result.message || result.error || "Something went wrong. Please try again." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Cannot reach the server. Please check your connection." });
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const formatTime = (date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen w-screen bg-[#EAF5EA] font-sans flex flex-col">
      {/* HEADER */}
      <div className="bg-[#1B5E20] text-white px-6 h-[72px] flex items-center justify-between shadow-md border-b-[3px] border-[#F5C518] flex-shrink-0">
        <div className="flex items-center gap-3.5">
          <img src={logo} alt="CvSU Logo" className="w-12 h-12 object-contain flex-shrink-0" />
          <div>
            <p className="text-[17px] font-bold leading-tight">Library Patron Access and Monitoring System</p>
            <p className="text-[11px] opacity-75 mt-0.5">Guest Entry</p>
          </div>
        </div>
        <div className="text-[26px] font-bold font-mono tracking-wide">{formatTime(currentTime)}</div>
      </div>

      {/* BODY */}
      <div className="flex-1 flex justify-center py-10 px-4">
        <div className="w-full max-w-[680px] space-y-5">

          {/* Welcome card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Welcome Guest!</h2>
            <p className="text-sm text-gray-500">
              Please fill in the form below to log your visit to the Ladislao N. Diwa Memorial Library.
            </p>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div className={`rounded-xl p-4 text-sm font-medium ${feedback.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {feedback.message}
            </div>
          )}

          {/* Form card */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] px-6 py-4 border-b-[3px] border-[#F5C518]">
              <h3 className="text-white font-semibold text-lg">Guest Entry Form</h3>
            </div>

            <div className="p-6 space-y-6">

              {/* I AM A */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">I am a...</p>
                <div className="grid grid-cols-4 gap-3">
                  {VISITOR_TYPES.map(({ id, label, icon: Icon }) => (
                    <button
                      type="button"
                      key={id}
                      onClick={() => setGuestType(id)}
                      className={`flex flex-col items-center justify-center gap-2 py-4 rounded-lg border-2 transition-colors ${
                        guestType === id
                          ? "border-[#1B5E20] bg-green-50 text-[#1B5E20]"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <Icon active={guestType === id} />
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 border-b pb-2">Personal Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-xs text-gray-500 mb-1 block">Affiliation / Institution</label>
                  <input
                    type="text"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    placeholder="e.g. CvSU - CEIT Dept."
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600"
                  />
                </div>
              </div>

              {/* Purpose of Visit */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 border-b pb-2">Purpose of Visit</p>
                <div className="grid grid-cols-2 gap-3">
                  {PURPOSES.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="radio"
                        name="purpose"
                        checked={purpose === p}
                        onChange={() => setPurpose(p)}
                        className="accent-[#1B5E20]"
                      />
                      {p}
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="text-xs text-gray-500 mb-1 block">Other purpose (optional)</label>
                  <input
                    type="text"
                    value={otherPurpose}
                    onChange={(e) => setOtherPurpose(e.target.value)}
                    placeholder="Type here..."
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1B5E20] hover:bg-[#164a1a] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
              >
                {submitting ? "Logging visit..." : "Log My Visit →"}
              </button>
              <p className="text-center text-[11px] text-gray-400">
                Your information is recorded securely and used only for library access monitoring.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GuestEntry;