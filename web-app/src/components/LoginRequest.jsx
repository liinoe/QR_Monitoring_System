import React, { useEffect, useRef, useState } from "react";
import { authFetch, describeUserAgent, isLoggedIn } from "../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const POLL_MS = 8000; // every 8 s (the waiting browser has ~60 s, so this is plenty)

/**
 * Shown on every signed-in admin page (mounted by ProtectedRoute).
 * Every few seconds it asks the server whether someone is trying to sign in
 * to this account from another browser, and if so shows an Allow / Deny prompt.
 * The polling also acts as this browser's "I'm still here" heartbeat.
 */
const LoginRequestWatcher = () => {
     const [requests, setRequests] = useState([]);
     const [busyId, setBusyId] = useState(null);
     const [error, setError] = useState("");
     const [, setTick] = useState(0); // re-render every second for the countdown
     const fetchedAt = useRef(Date.now());
     const originalTitle = useRef(document.title);

     const loadRequests = async () => {
     if (!isLoggedIn()) return;
     try {
          const res = await authFetch(`${API_URL}/api/admin/login-requests/pending`);
          if (!res.ok) return;
          const data = await res.json();
          fetchedAt.current = Date.now();
          setRequests(Array.isArray(data) ? data : []);
     } catch {
          // offline for a moment — try again next tick
     }
     };

     useEffect(() => {
     loadRequests();
     const poll = setInterval(loadRequests, POLL_MS);
     const clock = setInterval(() => setTick((t) => t + 1), 1000);
     return () => {
          clearInterval(poll);
          clearInterval(clock);
     };
     }, []);

     // Flash the tab title so the prompt gets noticed even from another tab.
     useEffect(() => {
     if (requests.length === 0) {
          document.title = originalTitle.current;
          return;
     }
     let on = false;
     const flash = setInterval(() => {
          on = !on;
          document.title = on ? "⚠ Sign-in request" : originalTitle.current;
     }, 1000);
     return () => {
          clearInterval(flash);
          document.title = originalTitle.current;
     };
     }, [requests.length]);

     const decide = async (requestId, decision) => {
     setBusyId(requestId);
     setError("");
     try {
          const res = await authFetch(`${API_URL}/api/admin/login-requests/${requestId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
          });
          if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.message || "Could not send your answer.");
          }
          setRequests((list) => list.filter((r) => r.request_id !== requestId));
     } catch {
          setError("Could not reach the server. Please try again.");
     } finally {
          setBusyId(null);
     }
     };

     const elapsed = Math.floor((Date.now() - fetchedAt.current) / 1000);
     const visible = requests
     .map((r) => ({ ...r, left: Math.max(0, (r.seconds_left ?? 0) - elapsed) }))
     .filter((r) => r.left > 0);

     if (visible.length === 0) return null;
     const req = visible[0]; // answer one at a time

     return (
     <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[420px] bg-white rounded-[8px] shadow-md p-6 font-sans">
          <div className="flex items-center gap-3 mb-4">
               <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold">
               !
               </div>
               <div>
               <p className="text-base font-semibold text-gray-800">New sign-in request</p>
               <p className="text-xs text-gray-500">Someone is trying to sign in to your account.</p>
               </div>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm space-y-1 mb-4">
               <p><span className="text-gray-500">Device:</span> <span className="font-medium text-gray-800">{describeUserAgent(req.user_agent)}</span></p>
               {req.ip_address && (
               <p><span className="text-gray-500">IP address:</span> <span className="font-medium text-gray-800">{req.ip_address}</span></p>
               )}
               <p>
               <span className="text-gray-500">Requested:</span>{" "}
               <span className="font-medium text-gray-800">
               {new Date(req.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
               </span>
               </p>
          </div>

          <p className="text-xs text-gray-500 mb-4">
               If you allow it, both browsers will stay signed in. If this wasn't you or a teammate, deny it and change your password.
               This request expires in <span className="font-semibold text-gray-700">{req.left}s</span>.
          </p>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

          <div className="flex gap-3">
               <button
               type="button"
               disabled={busyId === req.request_id}
               onClick={() => decide(req.request_id, "deny")}
               className="flex-1 border border-red-200 text-red-700 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-60"
               >
               Deny
               </button>
               <button
               type="button"
               disabled={busyId === req.request_id}
               onClick={() => decide(req.request_id, "approve")}
               className="flex-1 bg-[#1B651B] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#165516] disabled:opacity-60"
               >
               Allow
               </button>
          </div>

          {visible.length > 1 && (
               <p className="text-[11px] text-gray-400 mt-3 text-center">{visible.length - 1} more request(s) waiting</p>
          )}
          </div>
     </div>
     );
};

export default LoginRequestWatcher;