import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { saveSession, isLoggedIn, consumeAuthNotice, getAdmin, revokeToken } from "../../auth";
import cvsuLogo from "../../assets/cvsu_logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const POLL_MS = 2000;

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [checkingSetup, setCheckingSetup] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    // Sign-in approval: set while waiting for the already-signed-in browser to answer.
    const [pending, setPending] = useState(null); // { requestId, secondsLeft }
    const pollRef = useRef(null);
    const countdownRef = useRef(null);

    useEffect(() => {
        if (isLoggedIn()) {
            navigate("/", { replace: true });
            return;
        }

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

    const stopWaiting = () => {
        clearInterval(pollRef.current);
        clearInterval(countdownRef.current);
        pollRef.current = null;
        countdownRef.current = null;
        setPending(null);
    };

    // If the page is closed while waiting, withdraw the request so the other
    // browser's prompt disappears.
    useEffect(() => {
        const cancelOnLeave = () => {
            if (pending?.requestId) {
                navigator.sendBeacon?.(`${API_URL}/api/admin/login-requests/${pending.requestId}/cancel`);
            }
        };
        window.addEventListener("pagehide", cancelOnLeave);
        return () => window.removeEventListener("pagehide", cancelOnLeave);
    }, [pending?.requestId]);

    useEffect(() => () => {
        clearInterval(pollRef.current);
        clearInterval(countdownRef.current);
    }, []);

    // One account per browser: if another tab signed in while this one was on
    // the login page, don't let a second account overwrite it.
    const finishLogin = (token, admin) => {
        if (isLoggedIn()) {
            const current = getAdmin();
            revokeToken(token); // throw away the new session — this browser already has one
            if (current?.admin_id === admin.admin_id) {
                navigate("/", { replace: true });
                return;
            }
            setError(`${current?.email || "Another account"} is already signed in on this browser. Log out first to switch accounts.`);
            return;
        }
        saveSession(token, admin);
        navigate("/");
    };

    const startWaiting = (requestId, expiresIn) => {
        setPending({ requestId, secondsLeft: expiresIn });

        countdownRef.current = setInterval(() => {
            setPending((p) => (p ? { ...p, secondsLeft: Math.max(0, p.secondsLeft - 1) } : p));
        }, 1000);

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/admin/login-requests/${requestId}/status`);
                const data = await res.json();

                if (data.status === "approved" && data.token) {
                    stopWaiting();
                    finishLogin(data.token, data.admin);
                } else if (data.status === "denied") {
                    stopWaiting();
                    setError("Your sign-in was denied by the browser where this account is already signed in.");
                } else if (data.status === "expired") {
                    stopWaiting();
                    setError("No response from the other browser. Please try signing in again.");
                } else if (["cancelled", "completed", "not_found"].includes(data.status)) {
                    stopWaiting();
                }
            } catch {
                // server briefly unreachable — keep waiting
            }
        }, POLL_MS);
    };

    const cancelWaiting = () => {
        const requestId = pending?.requestId;
        stopWaiting();
        if (requestId) {
            fetch(`${API_URL}/api/admin/login-requests/${requestId}/cancel`, { method: "POST" }).catch(() => {});
        }
    };

    if (checkingSetup) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
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

            // 202 = this account is open in another browser; wait for its approval.
            if (res.status === 202 && data.approval_required) {
                startWaiting(data.request_id, data.expires_in || 60);
                return;
            }

            finishLogin(data.token, data.admin);
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

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {pending ? (
                    // WAITING FOR APPROVAL
                    <div className="text-center">
                        <div className="mx-auto mb-4 w-12 h-12 rounded-full border-4 border-green-100 border-t-[#1B651B] animate-spin" />
                        <p className="text-sm font-semibold text-gray-800">Waiting for approval</p>
                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                            <span className="font-medium text-gray-700">{email}</span> is already signed in on another browser.
                            A prompt was sent there — ask them to click <span className="font-medium">Allow</span>.
                        </p>
                        <p className="text-xs text-gray-400 mt-3">
                            Expires in <span className="font-semibold text-gray-600">{pending.secondsLeft}s</span>
                        </p>
                        <button
                            type="button"
                            onClick={cancelWaiting}
                            className="w-full mt-5 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                id="admin-email"
                                name="email"
                                type="email"
                                required
                                autoComplete="username"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B651B]"
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
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B651B]"
                                    placeholder="••••••••"
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
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#1B651B] text-white py-2 rounded-lg font-medium hover:bg-[#165516] transition-colors disabled:opacity-60"
                        >
                            {loading ? "Signing in..." : "Sign In"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;