import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Small confirmation box that opens right next to the button that was clicked
// (not a big pop-up in the middle of the screen).
//   anchor     the clicked button's position (from getBoundingClientRect), or null = closed
//   title      e.g. "Approve this registration?"
//   message    short gray line under the title
//   confirmText / onConfirm / onCancel
// Closes when clicking outside, pressing Esc, or scrolling the page.
const WIDTH = 260;

const ConfirmPopover = ({ anchor, title, message, confirmText = "Confirm", onConfirm, onCancel }) => {
  const boxRef = useRef(null);

  useEffect(() => {
    if (!anchor) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) onCancel(); };
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    const close = () => onCancel();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true); // the box would no longer sit next to the button
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor, onCancel]);

  if (!anchor) return null;

  // Under the button, lined up with its left edge. Opens ABOVE it instead
  // when the button is near the bottom of the screen; always kept on screen.
  const openUp = anchor.bottom + 150 > window.innerHeight;
  const left = Math.min(Math.max(anchor.left, 8), window.innerWidth - WIDTH - 8);
  const style = openUp
    ? { left, bottom: window.innerHeight - anchor.top + 8, width: WIDTH }
    : { left, top: anchor.bottom + 8, width: WIDTH };

  return createPortal(
    <div
      ref={boxRef}
      style={style}
      className="fixed z-50 bg-white border border-[#E4E4E7] rounded-[8px] shadow-md p-3.5"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {message && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{message}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-[6px] border border-[#E4E4E7] text-xs font-semibold text-gray-700 hover:bg-[#F4F4F5]"
        >
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          onClick={onConfirm}
          className="px-3 py-1.5 rounded-[6px] bg-[#1B5E20] text-xs font-semibold text-white hover:bg-[#164a1a]"
        >
          {confirmText}
        </button>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmPopover;
