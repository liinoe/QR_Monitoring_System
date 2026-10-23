import React, { useState, useRef } from "react";

// Shows a small dark-green bubble under its child when hovered
// (same color as the app header). Uses "fixed" so it's never cut off by tables/cards.
const HoverTooltip = ({ label, children, className = "" }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  // Places the bubble under the hovered item, kept inside the screen edges.
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const idealLeft = rect.left + rect.width / 2;
    const clampedLeft = Math.min(Math.max(idealLeft, 140), window.innerWidth - 140);
    setCoords({ top: rect.bottom + 10, left: clampedLeft });
  };

  return (
    <span
      ref={triggerRef}
      onMouseEnter={() => { updatePosition(); setShow(true); }}
      onMouseLeave={() => setShow(false)}
      className={`relative inline-flex ${className}`}
    >
      {children}
      {show && (
        <span
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-50 -translate-x-1/2 max-w-[260px] bg-[#0E3B1F] text-white shadow-md rounded-[8px] px-3 py-2 text-xs leading-relaxed"
        >
          {label}
          <span className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#0E3B1F] rotate-45" />
        </span>
      )}
    </span>
  );
};

export default HoverTooltip;
