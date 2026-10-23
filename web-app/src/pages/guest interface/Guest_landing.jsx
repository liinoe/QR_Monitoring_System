import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GuestLayout, Card, Icon, ScanFrame, BRAND, getGreeting, useNow } from "./GuestLayout";

// Guest welcome page (kiosk). Guests pick "Log In" (entering) or "Log Out" (leaving).
const GuestLanding = () => {
  const navigate = useNavigate();
  const now = useNow();
  // Which card is green: "login" by default, or whichever card the mouse is on.
  const [highlighted, setHighlighted] = useState("login");

  return (
    <GuestLayout subtitle={`${getGreeting(now)}, guest!`} title="Welcome to the Library">
      <div className="w-full max-w-[860px] flex flex-col justify-center gap-6 pb-6">
        <div className="text-center mb-2">
          <h2 className="text-[22px] font-bold text-gray-900">What would you like to do?</h2>
          <p className="text-sm text-gray-500 mt-1">Log your visit when you arrive, and log out before you leave.</p>
        </div>

        {/* Two big choices, side by side. Leaving the area makes Log In green again. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" onMouseLeave={() => setHighlighted("login")}>
          <ActionCard
            icon="login"
            title="Log In"
            caption="I'm entering the library"
            active={highlighted === "login"}
            onHover={() => setHighlighted("login")}
            onClick={() => navigate("/guest")}
          />
          <ActionCard
            icon="logout"
            title="Log Out"
            caption="I'm leaving the library"
            active={highlighted === "logout"}
            onHover={() => setHighlighted("logout")}
            onClick={() => navigate("/guest-logout")}
          />
        </div>

        {/* Library hours + privacy note, like the info rows in the app */}
        <Card className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-[#F1F3F1]">
          <InfoItem icon="time" label="Library hours" value="7:00 AM – 6:00 PM · cut-off 5:30 PM" />
          <InfoItem icon="shield" label="Your privacy" value="Used only for library access monitoring" />
        </Card>
      </div>
    </GuestLayout>
  );
};

// Big tappable card for Log In / Log Out.
//   active = green card (hovered, or Log In by default); otherwise a white card.
const ActionCard = ({ icon, title, caption, active, onHover, onClick }) => (
  <button
    onClick={onClick}
    onMouseEnter={onHover}
    onFocus={onHover}
    className={`relative overflow-hidden text-left rounded-[12px] p-7 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#1B5E20]/20 ${
      active ? "text-white border border-[#1B5E20]" : "text-gray-900 border border-[#E4E4E7]"
    }`}
    style={{ backgroundColor: active ? BRAND.green : "#FFFFFF" }}
  >
    <ScanFrame size={68} arm={16}>
      <div
        className="w-12 h-12 rounded-[12px] flex items-center justify-center transition-colors duration-200"
        style={active ? { backgroundColor: "rgba(255,255,255,0.14)", color: "#FFFFFF" } : { backgroundColor: BRAND.mint, color: BRAND.green }}
      >
        <Icon name={icon} size={24} />
      </div>
    </ScanFrame>

    <p className="text-[24px] font-bold mt-6">{title}</p>
    <p className={`text-sm mt-1 transition-colors duration-200 ${active ? "text-white/75" : "text-gray-500"}`}>{caption}</p>
  </button>
);

// One info item with a mint icon circle (icon · label · value).
const InfoItem = ({ icon, label, value }) => (
  <div className="flex-1 flex items-center gap-3 px-5 py-4">
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BRAND.mint, color: BRAND.green }}>
      <Icon name={icon} size={17} />
    </div>
    <div>
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  </div>
);

export default GuestLanding;