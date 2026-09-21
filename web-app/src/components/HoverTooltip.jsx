import React, { useState, useRef } from "react";

const HoverTooltip = ({ label, children, className = "" }) => {
     const [show, setShow] = useState(false);
     const [coords, setCoords] = useState({ top: 0, left: 0 });
     const triggerRef = useRef(null);

     const updatePosition = () => {
     if (!triggerRef.current) return;
     const rect = triggerRef.current.getBoundingClientRect();
     const idealLeft = rect.left + rect.width / 2;
     const clampedLeft = Math.min(Math.max(idealLeft, 130), window.innerWidth - 130);
     setCoords({ top: rect.bottom + 8, left: clampedLeft });
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
               className="fixed z-50 -translate-x-1/2 max-w-[240px] bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs text-gray-700 leading-snug"
          >
               {label}
               <span className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-l border-t border-gray-200 rotate-45" />
          </span>
          )}
     </span>
     );
};

export default HoverTooltip;