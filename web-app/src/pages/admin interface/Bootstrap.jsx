import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import cvsuLogo from "../../assets/cvsu_logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Bootstrap = () => {
     const navigate = useNavigate();
     const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
     const [error, setError] = useState("");
     const [loading, setLoading] = useState(false);
     const [showPassword, setShowPassword] = useState(false);
     const [showConfirmPassword, setShowConfirmPassword] = useState(false);

     const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

     const handleSubmit = async (e) => {
     e.preventDefault();
     setError("");

     if (form.password !== form.confirmPassword) {
          setError("Passwords do not match.");
          return;
     }
     if (form.password.length < 8) {
          setError("Password must be at least 8 characters.");
          return;
     }

     setLoading(true);
     try {
          const res = await fetch(`${API_URL}/api/admin/bootstrap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
          });
          const data = await res.json();

          if (!res.ok) {
          setError(data.message || "Setup failed.");
          return;
          }

          alert("Super admin account created! Please sign in.");
          navigate("/login");
     } catch (err) {
          console.error(err);
          setError("Could not reach the server. Please try again.");
     } finally {
          setLoading(false);
     }
     };

     return (
     <div className="w-screen min-h-screen flex items-center justify-center bg-[#F6F6F5] font-sans">
          <div className="w-full max-w-[420px] bg-white p-8 rounded-[10px] border shadow-sm">
          <div className="flex flex-col items-center mb-6">
               <img src={cvsuLogo} alt="CvSU Logo" className="w-16 h-16 object-contain mb-3" />
               <h1 className="text-lg font-bold text-gray-800 text-center leading-tight">
               Initial System Setup
               </h1>
               <p className="text-xs text-gray-500 mt-1 text-center">
               No admin accounts exist yet. Create the first super admin account to get started.
               </p>
          </div>

          {error && (
               <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">
               {error}
               </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
               <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
               <input
               name="name"
               required
               value={form.name}
               onChange={handleChange}
               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B651B]"
               />
               </div>
               <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
               <input
               name="email"
               type="email"
               required
               value={form.email}
               onChange={handleChange}
               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B651B]"
               />
               </div>
               <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
               <div className="relative">
               <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B651B]"
               />
               <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B651B] hover:underline"
               >
                    {showPassword ? "Hide" : "Show"}
               </button>
               </div>
               </div>
               <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
               <div className="relative">
               <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B651B]"
               />
               <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B651B] hover:underline"
               >
                    {showConfirmPassword ? "Hide" : "Show"}
               </button>
               </div>
               </div>
               <button
               type="submit"
               disabled={loading}
               className="w-full bg-[#1B651B] text-white py-2 rounded-lg font-medium hover:bg-[#165516] transition-colors disabled:opacity-60"
               >
               {loading ? "Creating..." : "Create Super Admin Account"}
               </button>
          </form>
          </div>
     </div>
     );
};

export default Bootstrap;