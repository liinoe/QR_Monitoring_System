import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GuestLayout, Card, SectionLabel, Dialog, Icon, btn, inputClass, BRAND } from "./GuestLayout";

// Visitor type icons (color follows the button's text color).
// Faculty: teacher pointing at a board.
const FacultyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="10" y="3" width="12" height="9" rx="1" />
    <circle cx="5" cy="7" r="2.5" />
    <path d="M1.5 21v-3.5A3.5 3.5 0 0 1 5 14a3.5 3.5 0 0 1 3.5 3.5V21" />
    <path d="M7.5 14.5L12 10" />
  </svg>
);

// Alumni: graduation cap icon.
const AlumniIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10L12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
  </svg>
);

// Walk-in: walking person icon.
const WalkinIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4.5" r="2" />
    <path d="M10 8l2 3 2-3" />
    <path d="M12 11v5" />
    <path d="M12 16l-3 5" />
    <path d="M12 16l3 5" />
    <path d="M9 13l-3 2" />
  </svg>
);

// Student: person icon.
const StudentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1c0-3.3 3.6-6 8-6s8 2.7 8 6v1" />
  </svg>
);

const VISITOR_TYPES = [
  { id: "faculty", label: "Faculty", icon: FacultyIcon },
  { id: "alumni", label: "Alumni", icon: AlumniIcon },
  { id: "walkin", label: "Walk-in", icon: WalkinIcon },
  { id: "student", label: "Student", icon: StudentIcon },
];

// Shown only when "Student" is picked. "Other" = another school or another CvSU campus.
const STUDENT_TYPES = [
  { id: "JHS", label: "Junior High (JHS)", value: "Junior High School (JHS)" },
  { id: "SHS", label: "Senior High (SHS)", value: "Senior High School (SHS)" },
  { id: "Other", label: "Other", value: "" },
];

const PURPOSES = ["Book Reference", "Research / Thesis", "Library Visit", "General Reading", "Other"];

const HOW_TO_STEPS = [
  { title: "Go to the Log Out screen", detail: "From the welcome screen, tap the \"Log Out\" button." },
  { title: "Search for your name", detail: "Type your name in the search box to find your entry." },
  { title: "Tap \"Log Out\"", detail: "Confirm, and your visit will be closed out." },
];

// Guest entry form: guest picks a type, enters their details and purpose, then confirms.
const GuestEntry = () => {
  const navigate = useNavigate();
  const [guestType, setGuestType] = useState("faculty");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [studentType, setStudentType] = useState("");   // JHS / SHS / Other (students only)
  const [studentSchool, setStudentSchool] = useState(""); // school name when "Other" is picked
  const [purpose, setPurpose] = useState("Book Reference");
  const [otherPurpose, setOtherPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Welcome pop-up after a successful log, with the "don't forget to log out" reminder.
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [loggedGuestName, setLoggedGuestName] = useState("");

  // Clears the form back to its starting values.
  const resetForm = () => {
    setGuestType("faculty");
    setFirstName("");
    setLastName("");
    setAffiliation("");
    setStudentType("");
    setStudentSchool("");
    setPurpose("Book Reference");
    setOtherPurpose("");
  };

  const isStudent = guestType === "student";

  // What gets saved as the guest's affiliation.
  // Students: their type (JHS / SHS) or the school they typed under "Other".
  // Everyone else: the Affiliation / Institution box.
  const getAffiliation = () => {
    if (!isStudent) return affiliation.trim();
    if (studentType === "Other") return studentSchool.trim();
    return STUDENT_TYPES.find((l) => l.id === studentType)?.value || "";
  };

  // "Review & Log Visit": checks the fields, then opens the confirm pop-up.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setFeedback({ type: "error", message: "Please fill in all required fields." });
      return;
    }
    if (isStudent && !studentType) {
      setFeedback({ type: "error", message: "Please choose your student type (JHS, SHS, or Other)." });
      return;
    }
    if (isStudent && studentType === "Other" && !studentSchool.trim()) {
      setFeedback({ type: "error", message: "Please type the school or CvSU campus you're from." });
      return;
    }
    if (!isStudent && !affiliation.trim()) {
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

  // "Confirm": sends the visit to the server, then shows the welcome pop-up.
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
          affiliation: getAffiliation(),
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

  // "Got it, Continue": closes the welcome pop-up and returns to the landing page.
  const handleContinueToLanding = () => {
    setShowWelcomeModal(false);
    setShowHowTo(false);
    navigate("/guest-landing");
  };

  const purposeText = purpose === "Other" ? otherPurpose : purpose;

  return (
    <GuestLayout subtitle="Guest Log In" title="Log Your Visit" onBack={() => navigate("/guest-landing")}>
      <form onSubmit={handleSubmit} className="w-full max-w-[720px] space-y-6">
        {/* Error banner */}
        {feedback && feedback.type === "error" && (
          <div className="flex items-center gap-3 rounded-[14px] px-4 py-3 text-sm font-semibold bg-[#FBDFDB] text-[#B3261E]">
            <Icon name="alert" size={18} />
            {feedback.message}
          </div>
        )}

        {/* I AM A */}
        <div>
          <SectionLabel>I am a…</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {VISITOR_TYPES.map(({ id, label, icon: TypeIcon }) => {
              const active = guestType === id;
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => setGuestType(id)}
                  className={`relative flex flex-col items-center justify-center gap-2.5 py-5 rounded-[20px] border-2 transition-all ${
                    active
                      ? "border-[#1B5E20] bg-white text-[#1B5E20] shadow-[0_6px_18px_rgba(27,94,32,0.15)]"
                      : "border-transparent bg-white text-gray-400 shadow-[0_4px_16px_rgba(11,31,18,0.06)] hover:text-gray-600"
                  }`}
                >
                  {active && (
                    <span className="absolute top-2.5 right-2.5 text-[#1B5E20]">
                      <Icon name="check" size={16} />
                    </span>
                  )}
                  <span
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: active ? BRAND.mint : "#F4F5F4" }}
                  >
                    <TypeIcon />
                  </span>
                  <span className={`text-sm font-semibold ${active ? "text-[#1B5E20]" : "text-gray-600"}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Personal Information */}
        <div>
          <SectionLabel>Personal information</SectionLabel>
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First name">
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} />
              </Field>
              <Field label="Last name">
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputClass} />
              </Field>
            </div>
            {isStudent ? (
              // Students pick their type instead of typing an affiliation.
              <div>
                <span className="text-[12px] font-semibold text-gray-600 mb-1.5 block">Student type</span>
                {/* Same pill buttons as "Purpose of visit" */}
                <div className="flex flex-wrap gap-2.5">
                  {STUDENT_TYPES.map((t) => {
                    const active = studentType === t.id;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setStudentType(t.id)}
                        className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                          active ? "bg-[#1B5E20] text-white" : "bg-[#F4F5F4] text-gray-600 hover:bg-[#E8F1E9] hover:text-[#1B5E20]"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Only shows when "Other" is picked */}
                {studentType === "Other" && (
                  <div className="mt-4">
                    <Field label="School / Campus">
                      <input
                        type="text"
                        value={studentSchool}
                        onChange={(e) => setStudentSchool(e.target.value)}
                        placeholder="e.g. CvSU Silang Campus, or your school's name"
                        className={inputClass}
                        autoFocus
                      />
                    </Field>
                  </div>
                )}
              </div>
            ) : (
              <Field label="Affiliation / Institution">
                <input
                  type="text"
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  placeholder="e.g. CvSU - CEIT Dept."
                  required
                  className={inputClass}
                />
              </Field>
            )}
          </Card>
        </div>

        {/* Purpose of Visit — pill buttons instead of radio circles */}
        <div>
          <SectionLabel>Purpose of visit</SectionLabel>
          <Card className="p-6">
            <div className="flex flex-wrap gap-2.5">
              {PURPOSES.map((p) => {
                const active = purpose === p;
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPurpose(p)}
                    className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                      active ? "bg-[#1B5E20] text-white" : "bg-[#F4F5F4] text-gray-600 hover:bg-[#E8F1E9] hover:text-[#1B5E20]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            {purpose === "Other" && (
              <div className="mt-4">
                <Field label="Please specify">
                  <input
                    type="text"
                    value={otherPurpose}
                    onChange={(e) => setOtherPurpose(e.target.value)}
                    placeholder="Type here..."
                    required
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
          </Card>
        </div>

        {/* Submit */}
        <div className="pt-1">
          <button type="submit" disabled={submitting} className={`${btn.primary} w-full text-base py-4`}>
            Review & Log Visit
            <Icon name="arrow" size={18} />
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-gray-400 mt-3">
            <Icon name="shield" size={13} />
            Your information is recorded securely and used only for library access monitoring.
          </p>
        </div>
      </form>

      {/* Confirm details pop-up */}
      <Dialog
        open={showConfirm}
        tone="info"
        icon="people"
        title="Confirm Your Details"
        message="Please check that everything is correct."
        footer={
          <>
            <button type="button" onClick={() => setShowConfirm(false)} disabled={submitting} className={btn.secondary}>
              Edit Details
            </button>
            <button type="button" onClick={confirmSubmit} disabled={submitting} className={btn.primary}>
              {submitting ? "Logging..." : "Confirm"}
            </button>
          </>
        }
      >
        <div className="rounded-[16px] bg-[#F7F8F7] divide-y divide-[#ECEFEC]">
          <DetailRow label="Visitor type" value={VISITOR_TYPES.find((v) => v.id === guestType)?.label || guestType} />
          <DetailRow label="Name" value={`${firstName} ${lastName}`} />
          <DetailRow label={!isStudent ? "Affiliation" : studentType === "Other" ? "School / Campus" : "Student type"} value={getAffiliation()} />
          <DetailRow label="Purpose" value={purposeText} />
        </div>
      </Dialog>

      {/* Welcome + "Don't forget to log out" pop-up */}
      <Dialog
        open={showWelcomeModal}
        tone="success"
        title={`Welcome, ${loggedGuestName}!`}
        message="Your visit has been logged successfully."
        footer={
          <button type="button" onClick={handleContinueToLanding} className={btn.primary}>
            Got it, Continue
          </button>
        }
      >
        {/* Gold reminder banner */}
        <div className="flex items-start gap-3 rounded-[16px] p-4" style={{ backgroundColor: BRAND.goldSoft, color: "#946800" }}>
          <Icon name="time" size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Don't forget to log out!</p>
            <p className="text-xs mt-1 leading-relaxed">
              Before you leave the library, please log your exit so your visit record is complete.
            </p>
          </div>
        </div>

        {/* Expandable "How do I log out?" */}
        <button
          type="button"
          onClick={() => setShowHowTo((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-semibold text-[#1B5E20] mt-4 px-1"
        >
          <span>How do I log out?</span>
          <span className={`transition-transform ${showHowTo ? "rotate-180" : ""}`}>
            <Icon name="chevron" size={18} />
          </span>
        </button>

        {showHowTo && (
          <div className="space-y-3 mt-3 rounded-[16px] bg-[#F7F8F7] p-4">
            {HOW_TO_STEPS.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full text-[#1B5E20] text-xs font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BRAND.mint }}>
                  {i + 1}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </GuestLayout>
  );
};

// Small label above an input.
const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-[12px] font-semibold text-gray-600 mb-1.5 block">{label}</span>
    {children}
  </label>
);

// One "label ........ value" line in the confirm pop-up.
const DetailRow = ({ label, value }) => (
  <div className="flex justify-between gap-4 px-4 py-3 text-sm">
    <span className="text-gray-500 flex-shrink-0">{label}</span>
    <span className="font-semibold text-gray-800 text-right break-words">{value}</span>
  </div>
);

export default GuestEntry;