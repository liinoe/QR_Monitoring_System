import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveSession, isLoggedIn, isBrowserLockedByOther, getActiveLock, consumeAuthNotice } from "../../auth";
import cvsuLogo from "../../assets/cvsu_logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
};

const Login = () => {
     const navigate = useNavigate();
     const [email, setEmail] = useState("");
     const [password, setPassword] = useState("");
     const [error, setError] = useState("");
     const [loading, setLoading] = useState(false);
     const [checkingSetup, setCheckingSetup] = useState(true);
     const [showPassword, setShowPassword] = useState(false);
     // Non-null when another tab in this browser already holds an active
     // session — login is disabled entirely while this is set, since a
     // second identity in the same browser isn't allowed at all, not just
     // discouraged after the fact.
     const [lockedBy, setLockedBy] = useState(null);

     useEffect(() => {
     if (isLoggedIn()) {
          navigate("/", { replace: true });
          return;
     }

     // Surface why the person landed here, if it was a forced logout
     // (superseded session, expired token) rather than a normal visit.
     const notice = consumeAuthNotice();
     if (notice) setError(notice);

     fetch(`${API_URL}/api/admin/check-setup`)
          .then((res) => res.json())
          .then((data) => {
          if (data.needsSetup) {
               navigate("/bootstrap", { replace: true });
          } else {
               setCheckingSetup(false);
          }
          })
          .catch(() => setCheckingSetup(false)); 
     }, [navigate]);

     // Re-check the browser lock every time this screen is focused/mounted
     // — covers the case where the lock appears (another tab logs in)
     // while this tab is sitting idle on the Login screen.
     useEffect(() => {
     const checkLock = () => {
          const lock = getActiveLock();
          setLockedBy(lock);
     };
     checkLock();
     window.addEventListener("storage", checkLock);
     window.addEventListener("focus", checkLock);
     return () => {
          window.removeEventListener("storage", checkLock);
          window.removeEventListener("focus", checkLock);
     };
     }, []);

     if (checkingSetup) return null; 

     const handleSubmit = async (e) => {
     e.preventDefault();
     setError("");

     // Re-check right before submitting too — a login could have happened
     // in another tab in the moments since this screen last checked.
     if (isBrowserLockedByOther()) {
          const lock = getActiveLock();
          setLockedBy(lock);
          return;
     }

     setLoading(true);

     try {
          const res = await fetch(`${API_URL}/api/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          });
          const data = await res.json();

          if (!res.ok) {
          setError(data.message || "Login failed.");
          return;
          }

          saveSession(data.token, data.admin);
          navigate("/");
     } catch (err) {
          console.error(err);
          setError("Could not reach the server. Please try again.");
     } finally {
          setLoading(false);
     }
     };

     return (
     <div className="w-screen min-h-screen flex items-center justify-center bg-[#F6F6F5] font-sans">
          <div className="w-full max-w-[400px] bg-white p-8 rounded-[10px] border shadow-sm">
          <div className="flex flex-col items-center mb-6">
               <img src={cvsuLogo} alt="CvSU Logo" className="w-16 h-16 object-contain mb-3" />
               <h1 className="text-lg font-bold text-gray-800 text-center leading-tight">
               Library Patron Access and Monitoring System
               </h1>
               <p className="text-xs text-gray-500 mt-1">Admin Sign In</p>
          </div>

          {lockedBy && (
               <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg mb-4">
               <p className="font-medium">Another admin is already signed in on this browser</p>
               <p className="mt-1 text-amber-700">
                    {lockedBy.name} ({ROLE_LABELS[lockedBy.role] || lockedBy.role}) is currently active in another tab.
                    Please log out there first before signing in as a different account.
               </p>
               </div>
          )}

          {error && !lockedBy && (
               <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">
               {error}
               </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
               <div>
               <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
               <input
               id="admin-email"
               name="email"
               type="email"
               required
               autoComplete="username"
               disabled={!!lockedBy}
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B651B] disabled:bg-gray-100 disabled:text-gray-400"
               placeholder="admin@cvsu.edu.ph"
               />
               </div>
               <div>
               <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
               <div className="relative">
               <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    disabled={!!lockedBy}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B651B] disabled:bg-gray-100 disabled:text-gray-400"
                    placeholder="••••••••"
               />
               <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={!!lockedBy}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B651B] hover:underline disabled:text-gray-300"
               >
                    {showPassword ? "Hide" : "Show"}
               </button>
               </div>
               </div>
               <button
               type="submit"
               disabled={loading || !!lockedBy}
               className="w-full bg-[#1B651B] text-white py-2 rounded-lg font-medium hover:bg-[#165516] transition-colors disabled:opacity-60"
               >
               {loading ? "Signing in..." : "Sign In"}
               </button>
          </form>
          </div>
     </div>
     );
};

export default Login;