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

const StudentIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#1B5E20' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1c0-3.3 3.6-6 8-6s8 2.7 8 6v1" />
  </svg>
);

const ClockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="8 12 11 15 16 9" />
  </svg>
);

const VISITOR_TYPES = [
  { id: "faculty", label: "Faculty", icon: FacultyIcon },
  { id: "alumni", label: "Alumni", icon: AlumniIcon },
  { id: "walkin", label: "Walk-in", icon: WalkinIcon },
  { id: "student", label: "Student", icon: StudentIcon },
];

const PURPOSES = ["Book Reference", "Research / Thesis", "Library Visit", "General Reading", "Other"];

const HOW_TO_STEPS = [
  { title: "Go to the Log Out screen", detail: "From the welcome screen, tap the \"Log Out\" button." },
  { title: "Search for your name", detail: "Type your name in the search box to find your entry." },
  { title: "Tap \"Log Out\"", detail: "Confirm, and your visit will be closed out." },
];

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
  const [showConfirm, setShowConfirm] = useState(false);

  // Shown after a successful entry log — replaces the old auto-vanishing
  // toast, since "don't forget to log out" is important enough that it
  // shouldn't be something a guest can simply miss while looking away.
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [loggedGuestName, setLoggedGuestName] = useState("");

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !affiliation.trim()) {
      setFeedback({ type: "error", message: "Please fill in all required fields." });
      return;
    }
    if (purpose === "Other" && !otherPurpose.trim()) {
      setFeedback({ type: "error", message: "Please specify your purpose of visit." });
      return;
    }
    setFeedback(null);
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setSubmitting(true);
    setFeedback(null);
    const guestName = `${firstName.trim()} ${lastName.trim()}`;

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
        setShowConfirm(false);
        setLoggedGuestName(guestName);
        setShowWelcomeModal(true);
        resetForm();
      } else {
        setShowConfirm(false);
        const result = await response.json();
        setFeedback({ type: "error", message: result.message || result.error || "Something went wrong. Please try again." });
      }
    } catch (err) {
      setShowConfirm(false);
      setFeedback({ type: "error", message: "Cannot reach the server. Please check your connection." });
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleContinueToLanding = () => {
    setShowWelcomeModal(false);
    setShowHowTo(false);
    navigate("/guest-landing");
  };

  const formatTime = (date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen w-screen bg-[#EAF5EA] font-sans flex flex-col">
      {/* HEADER */}
      <div className="guest-header bg-[#1B5E20] text-white px-6 h-[72px] flex items-center justify-between shadow-md border-b-[3px] border-[#F5C518] flex-shrink-0">
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

          {/* Error banner */}
          {feedback && feedback.type === "error" && (
            <div className="rounded-xl p-4 text-sm font-medium bg-red-50 text-red-700 border border-red-200">
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
                    required
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
                {purpose === "Other" && (
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 mb-1 block">Please specify</label>
                    <input
                      type="text"
                      value={otherPurpose}
                      onChange={(e) => setOtherPurpose(e.target.value)}
                      placeholder="Type here..."
                      required
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600"
                    />
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1B5E20] hover:bg-[#164a1a] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
              >
                Review & Log Visit →
              </button>
              <p className="text-center text-[11px] text-gray-400">
                Your information is recorded securely and used only for library access monitoring.
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Confirm Info Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[420px] overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] px-6 py-4 border-b-[3px] border-[#F5C518]">
              <h3 className="text-white font-semibold text-lg">Confirm Your Details</h3>
              <p className="text-white/80 text-xs mt-0.5">Please check that everything is correct.</p>
            </div>

            <div className="p-6 space-y-3">
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-gray-500">Visitor Type</span>
                <span className="font-semibold text-gray-800 capitalize">
                  {VISITOR_TYPES.find((v) => v.id === guestType)?.label || guestType}
                </span>
              </div>
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-gray-500">Name</span>
                <span className="font-semibold text-gray-800">{firstName} {lastName}</span>
              </div>
              <div className="flex justify-between text-sm border-b pb-2 gap-4">
                <span className="text-gray-500 flex-shrink-0">Affiliation</span>
                <span className="font-semibold text-gray-800 text-right">{affiliation}</span>
              </div>
              <div className="flex justify-between text-sm gap-4">
                <span className="text-gray-500 flex-shrink-0">Purpose</span>
                <span className="font-semibold text-gray-800 text-right">
                  {purpose === "Other" ? otherPurpose : purpose}
                </span>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Edit Details
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                disabled={submitting}
                className="flex-1 bg-[#1B5E20] hover:bg-[#164a1a] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {submitting ? "Logging..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome + "Don't Forget to Log Out" Reminder Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[440px] overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] px-6 py-5 border-b-[3px] border-[#F5C518] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <CheckIcon />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Welcome, {loggedGuestName}!</h3>
                <p className="text-white/80 text-xs mt-0.5">Your visit has been logged successfully.</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Reminder banner */}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <ClockIcon />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Don't forget to log out!</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Before you leave the library, please log your exit so your visit record is complete.
                  </p>
                </div>
              </div>

              {/* Expandable "How do I log out?" */}
              <button
                type="button"
                onClick={() => setShowHowTo((v) => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold text-[#1B5E20] hover:underline"
              >
                <span>How do I log out?</span>
                <span className={`transition-transform ${showHowTo ? "rotate-180" : ""}`}>▾</span>
              </button>

              {showHowTo && (
                <div className="space-y-3 border-t pt-4">
                  {HOW_TO_STEPS.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 text-[#1B5E20] text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleContinueToLanding}
                className="w-full bg-[#1B5E20] hover:bg-[#164a1a] text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Got it, Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestEntry;