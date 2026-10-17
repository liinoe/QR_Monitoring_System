import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import { AuthInput, PasswordRules, checkPasswordRules } from "../../components/AuthInput";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Basic email shape: something@something.something (no spaces). Same as Login.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the message to show under the Email box, or "" if the email looks fine.
const checkEmail = (value) => {
    const email = value.trim();
    if (!email) return "Please enter your email.";
    if (!EMAIL_REGEX.test(email)) return "Enter a valid email, e.g. name@cvsu.edu.ph";
    return "";
};

// First-time setup: creates the very first Super Admin when no admin account exists.
// Same look as the Login page (green header, white card, app-style inputs).
const Bootstrap = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
    const [touched, setTouched] = useState({}); // which boxes were left, so errors don't nag while typing
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [done, setDone] = useState(false); // true = account created, show the success card

    // On open: if an admin already exists, setup is finished — go to Login instead.
    useEffect(() => {
        document.title = "Initial Setup · QLess";
        fetch(`${API_URL}/api/admin/check-setup`)
            .then((res) => res.json())
            .then((data) => {
                if (!data.needsSetup) navigate("/login", { replace: true });
                else setChecking(false);
            })
            .catch(() => setChecking(false));
    }, [navigate]);

    // Updates one field of the form.
    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    // Marks a box as "left", so its error message can show.
    const touch = (name) => () => setTouched((t) => ({ ...t, [name]: true }));

    const rules = checkPasswordRules(form.password);
    const passwordOk = Object.values(rules).every(Boolean);
    const nameError = !form.name.trim() ? "Please enter your full name." : "";
    const emailError = checkEmail(form.email);
    const confirmError = form.confirmPassword && form.confirmPassword !== form.password ? "Passwords do not match." : "";

    // "Create account": checks everything, then asks the server to create the Super Admin.
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setTouched({ name: true, email: true, confirmPassword: true });
        if (nameError || emailError) return;
        if (!passwordOk) {
            setError("Your password doesn't meet all the requirements yet.");
            return;
        }
        if (!form.confirmPassword || confirmError) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/bootstrap`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), password: form.password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || "Setup failed.");
                return;
            }
            setDone(true);
        } catch (err) {
            console.error(err);
            setError("Could not reach the server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (checking) return null;

    return (
        <div className="w-screen min-h-screen flex flex-col bg-[#F7F8F7] font-sans">
            <Header />

            <main className="flex-1 flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-[420px]">
                    <div className="bg-white rounded-[24px] px-7 py-8">
                        {done ? (
                            // SUCCESS
                            <div className="text-center animate-[fadeIn_.18s_ease-out]">
                                <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#E8F1E9] text-[#1B5E20] flex items-center justify-center">
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <h1 className="text-[22px] font-extrabold text-gray-900">You're all set</h1>
                                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                                    The Super Admin account for <span className="font-semibold text-gray-800">{form.email.trim().toLowerCase()}</span> was created.
                                    Sign in, then add the current semester in Settings.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate("/login", { replace: true })}
                                    className="w-full h-[52px] mt-6 rounded-[16px] bg-[#1B5E20] hover:bg-[#164a1a] text-white text-[15px] font-bold tracking-wide transition-colors"
                                >
                                    Go to Sign In
                                </button>
                            </div>
                        ) : (
                            // SETUP FORM
                            <>
                                <div className="text-center mb-7">
                                    <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#E8F1E9] text-[#1B5E20] flex items-center justify-center">
                                        {/* person with a plus: "create the first account" */}
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                                            <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                                        </svg>
                                    </div>
                                    <h1 className="text-[22px] font-extrabold text-gray-900">Initial setup</h1>
                                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                                        No admin account exists yet. Create the first <span className="font-semibold text-gray-700">Super Admin</span> to get started.
                                    </p>
                                </div>

                                {error && (
                                    <div className="flex items-start gap-2 rounded-[12px] bg-[#FBDFDB] text-[#B3261E] text-[13px] font-semibold px-4 py-3 mb-5">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="flex-shrink-0 mt-px">
                                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <span>{error}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                                    <AuthInput
                                        id="setup-name" name="name" label="Full name" autoComplete="name"
                                        placeholder="e.g. Juan Dela Cruz"
                                        value={form.name} onChange={handleChange} onBlur={touch("name")}
                                        error={touched.name && !!nameError}
                                    />
                                    {touched.name && nameError && <p className="text-[12.5px] text-[#B3261E] -mt-2 ml-0.5">{nameError}</p>}

                                    <AuthInput
                                        id="setup-email" name="email" label="Email" type="email" autoComplete="username"
                                        placeholder="name@cvsu.edu.ph"
                                        value={form.email} onChange={handleChange} onBlur={touch("email")}
                                        error={touched.email && !!emailError}
                                    />
                                    {touched.email && emailError && <p className="text-[12.5px] text-[#B3261E] -mt-2 ml-0.5">{emailError}</p>}

                                    <div>
                                        <AuthInput
                                            id="setup-password" name="password" label="Password" type="password" autoComplete="new-password"
                                            placeholder="Create a password"
                                            value={form.password} onChange={handleChange}
                                        />
                                        {/* live checklist, appears once they start typing */}
                                        <PasswordRules password={form.password} />
                                    </div>

                                    <AuthInput
                                        id="setup-confirm" name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password"
                                        placeholder="Type it again"
                                        value={form.confirmPassword} onChange={handleChange} onBlur={touch("confirmPassword")}
                                        error={!!confirmError && touched.confirmPassword}
                                    />
                                    {touched.confirmPassword && confirmError && <p className="text-[12.5px] text-[#B3261E] -mt-2 ml-0.5">{confirmError}</p>}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        style={{ marginTop: 24 }}
                                        className="w-full h-[52px] rounded-[16px] bg-[#1B5E20] hover:bg-[#164a1a] text-white text-[15px] font-bold tracking-wide transition-colors disabled:opacity-60"
                                    >
                                        {loading ? "Creating account…" : "Create Super Admin"}
                                    </button>
                                </form>

                                <p className="text-center text-[12.5px] text-gray-500 mt-5">
                                    This page only works once. After this, staff accounts are added in Settings.
                                </p>
                            </>
                        )}
                    </div>
                    <p className="text-center text-[11.5px] text-gray-400 mt-5">
                        Cavite State University · Ladislao N. Diwa Memorial Library
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Bootstrap;
