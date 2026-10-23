import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GuestLayout, Card, SectionLabel, Dialog, Icon, btn, inputClass, BRAND } from "./GuestLayout";

// Backend address (set VITE_API_URL when building for deployment).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// For privacy, names on this public screen are partly hidden:
// "John Snow" → "Jo*** Sn***". Every word keeps its first 2 letters and the
// rest becomes "***" (always 3 stars, so the name's length isn't shown either).
const maskName = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? `${word[0]}*` : `${word.slice(0, 2)}***`))
    .join(" ") || "Guest";

// First name only, for the "Goodbye" message (e.g. "John Snow" → "John").
const firstName = (name) => (name || "").trim().split(/\s+/)[0] || "Guest";

// Guest log out page: guest types their name, finds their (masked) entry and taps "Log Out".
const GuestLogout = () => {
  const navigate = useNavigate();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [loggingOutId, setLoggingOutId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  // Guest waiting for "Yes, Log Out" in the confirm pop-up.
  const [guestToConfirm, setGuestToConfirm] = useState(null);
  // Name shown in the "Goodbye" pop-up after a successful log out.
  const [loggedOutName, setLoggedOutName] = useState("");

  // Loads the guests who are still inside the library.
  const fetchInsideGuests = async () => {
    try {
      const res = await fetch(`${API_URL}/api/guests/inside`);
      const data = await res.json();
      setGuests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load guests:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load the list once when the page opens.
  useEffect(() => { fetchInsideGuests(); }, []);

  // "Yes, Log Out": ends the visit, shows "Goodbye", then returns to the landing page.
  const handleLogout = async () => {
    if (!guestToConfirm) return;

    const { guest_log_id, full_name } = guestToConfirm;
    setLoggingOutId(guest_log_id);
    setGuestToConfirm(null);
    setFeedback(null);

    try {
      const res = await fetch(`${API_URL}/api/guests/self-exit/${guest_log_id}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (res.ok) {
        setGuests((prev) => prev.filter((g) => g.guest_log_id !== guest_log_id));
        setLoggedOutName(firstName(full_name));
        setTimeout(() => navigate("/guest-landing"), 2200);
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

  // Search still matches the REAL full name, so guests can find themselves
  // by typing their name, but the list only ever shows the masked version.
  const filteredGuests = guests.filter((g) =>
    (g.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // The guest's purpose (uses their typed reason when they picked "Other").
  const displayReason = (g) =>
    g.purpose === "Other" && g.other_purpose ? g.other_purpose : g.purpose || "—";

  // Initials for the avatar circle, e.g. "Juan Dela Cruz" → "JC".
  const getInitials = (name) => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
  };

  return (
    <GuestLayout subtitle="Guest Log Out" title="Find Your Name" onBack={() => navigate("/guest-landing")}>
      <div className="w-full max-w-[720px] space-y-6">
        {/* Search box */}
        <div>
          <SectionLabel>Search</SectionLabel>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon name="search" size={19} />
            </span>
            <input
              type="text"
              placeholder="Type your full name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputClass} pl-12 py-4`}
              autoFocus
            />
          </div>
          <p className="flex items-center gap-1.5 text-[11.5px] text-gray-400 mt-2 ml-1">
            <Icon name="shield" size={13} />
            For your privacy, names are partly hidden (e.g. Jo*** Sn***).
          </p>
        </div>

        {/* Error banner */}
        {feedback && (
          <div className="flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-semibold bg-[#FBDFDB] text-[#B3261E]">
            <Icon name="alert" size={18} />
            {feedback.message}
          </div>
        )}

        {/* Guests still inside */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Currently inside</SectionLabel>
            {!loading && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full mb-2" style={{ backgroundColor: BRAND.mint, color: BRAND.green }}>
                {guests.length} {guests.length === 1 ? "guest" : "guests"}
              </span>
            )}
          </div>

          <Card className="overflow-hidden">
            {loading ? (
              <EmptyState icon="time" text="Loading..." />
            ) : filteredGuests.length === 0 ? (
              <EmptyState
                icon={guests.length === 0 ? "people" : "search"}
                text={guests.length === 0 ? "No guests currently inside." : "No match found. Check the spelling of your name."}
              />
            ) : (
              <ul className="divide-y divide-[#F1F3F1]">
                {filteredGuests.map((g) => (
                  <li key={g.guest_log_id} className="flex items-center gap-4 px-5 py-4">
                    <div
                      className="w-11 h-11 rounded-[8px] flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                      style={{ backgroundColor: BRAND.mint, color: BRAND.green }}
                    >
                      {getInitials(g.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-gray-900 truncate tracking-wide">{maskName(g.full_name)}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{displayReason(g)}</p>
                    </div>
                    <button
                      onClick={() => setGuestToConfirm(g)}
                      disabled={loggingOutId === g.guest_log_id}
                      className="inline-flex items-center gap-2 bg-[#1B5E20] hover:bg-[#164a1a] text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors disabled:opacity-60 flex-shrink-0"
                    >
                      <Icon name="logout" size={16} />
                      {loggingOutId === g.guest_log_id ? "Logging out..." : "Log Out"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Confirm pop-up */}
      <Dialog
        open={!!guestToConfirm}
        tone="warning"
        icon="logout"
        title="Log Out?"
        message={
          <>
            You're about to log out <span className="font-semibold text-gray-900">{maskName(guestToConfirm?.full_name)}</span>.
          </>
        }
        maxWidth={400}
        footer={
          <>
            <button onClick={() => setGuestToConfirm(null)} className={btn.secondary}>
              Cancel
            </button>
            <button onClick={handleLogout} className={btn.primary}>
              Yes, Log Out
            </button>
          </>
        }
      />

      {/* Goodbye pop-up (closes by itself and goes back to the landing page) */}
      <Dialog
        open={!!loggedOutName}
        tone="success"
        title={`Goodbye, ${loggedOutName}!`}
        message="Your visit has been logged out. Thank you for visiting the library."
        maxWidth={400}
      />
    </GuestLayout>
  );
};

// Centered icon + message shown when the list is loading or empty.
const EmptyState = ({ icon, text }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
    <div className="w-12 h-12 rounded-full bg-[#F4F5F4] flex items-center justify-center">
      <Icon name={icon} size={22} />
    </div>
    <p className="text-sm">{text}</p>
  </div>
);

export default GuestLogout;